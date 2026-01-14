const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    next();
});

const TEMP_DIR = path.join(__dirname, 'temp');

async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating temp directory:', error);
    }
}

async function cleanupTempFiles() {
    try {
        const files = await fs.readdir(TEMP_DIR);
        const now = Date.now();
        
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > 10 * 60 * 1000) {
                await fs.unlink(filePath);
            }
        }
    } catch (error) {
        console.error('Error cleaning temp files:', error);
    }
}

function generateVarName(index) {
    const chars = 'l1I';
    let name = '';
    let n = index;
    do {
        name = chars[n % chars.length] + name;
        n = Math.floor(n / chars.length);
    } while (n > 0);
    return '_' + name;
}

function obfuscateLuaCode(code, preset) {
    let obfuscated = code;
    
    // String obfuscation
    let stringIndex = 0;
    obfuscated = obfuscated.replace(/"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g, (match) => {
        const str = match.slice(1, -1);
        if (str.length < 3) return match;
        
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        
        return `(function()local t={${bytes.join(',')}}local s=''for i=1,#t do s=s..string.char(t[i])end return s end)()`;
    });
    
    // Variable name obfuscation (basic)
    if (preset === 'Medium' || preset === 'Strong') {
        const localVars = obfuscated.match(/local\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        if (localVars) {
            const uniqueVars = [...new Set(localVars.map(v => v.replace('local ', '')))];
            uniqueVars.forEach((varName, index) => {
                if (['print', 'local', 'function', 'end', 'if', 'then', 'else', 'for', 'while', 'do', 'return'].includes(varName)) {
                    return;
                }
                const newName = generateVarName(index);
                const regex = new RegExp(`\\b${varName}\\b`, 'g');
                obfuscated = obfuscated.replace(regex, newName);
            });
        }
    }
    
    // Add junk code
    if (preset === 'Strong') {
        const junk = `local ${generateVarName(999)}=function()return nil end;`;
        obfuscated = junk + obfuscated;
    }
    
    return obfuscated;
}

async function obfuscateLua(code, preset = 'Medium') {
    const startTime = Date.now();
    
    try {
        const obfuscatedCode = obfuscateLuaCode(code, preset);
        const header = '-- This file was protected using Mønlur Obfuscator [v1.0]\n\n';
        const finalCode = header + obfuscatedCode;
        
        const processingTime = Date.now() - startTime;
        
        return {
            success: true,
            code: finalCode,
            processingTime,
            originalSize: code.length,
            obfuscatedSize: finalCode.length
        };
        
    } catch (error) {
        throw error;
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/obfuscate', async (req, res) => {
    try {
        const { code, preset } = req.body;
        
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Code is required and must be a string' 
            });
        }
        
        if (code.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Code cannot be empty' 
            });
        }
        
        const validPresets = ['Weak', 'Medium', 'Strong'];
        const selectedPreset = validPresets.includes(preset) ? preset : 'Medium';
        
        const result = await obfuscateLua(code, selectedPreset);
        
        res.json(result);
        
    } catch (error) {
        console.error('Obfuscation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, async () => {
    console.log(`Obfuscation API running on port ${PORT}`);
    await ensureTempDir();
    setInterval(cleanupTempFiles, 5 * 60 * 1000);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
