const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const execFilePromise = util.promisify(execFile);

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
            try {
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > 10 * 60 * 1000) {
                    await fs.unlink(filePath);
                }
            } catch (err) {
                // Ignore
            }
        }
    } catch (error) {
        console.error('Error cleaning temp files:', error);
    }
}

// CONVERTER LUAU PARA LUA 5.1 - SIMPLES E DIRETO
function convertLuauToLua51(code) {
    let converted = code;
    
    // Adicionar funções do Roblox no início
    const robloxFunctions = `-- Roblox Functions
local task = task or {}
task.wait = task.wait or function(t) wait(t or 0) end
task.spawn = task.spawn or function(f) coroutine.wrap(f)() end
task.delay = task.delay or function(t, f) coroutine.wrap(function() wait(t) f() end)() end
local wait = wait or function(t) local s = os.clock() repeat until os.clock() - s >= (t or 0) end

`;
    
    // Remover tipos
    converted = converted.replace(/:\s*[\w<>|\[\]\.]+(\?)?(?=\s*[,\)=])/g, '');
    converted = converted.replace(/local\s+(\w+)\s*:\s*[\w<>|\[\]\.]+(\?)?\s*=/g, 'local $1 =');
    
    // Remover operadores compostos
    converted = converted.replace(/(\w+)\s*\+=\s*/g, '$1 = $1 + ');
    converted = converted.replace(/(\w+)\s*-=\s*/g, '$1 = $1 - ');
    converted = converted.replace(/(\w+)\s*\*=\s*/g, '$1 = $1 * ');
    converted = converted.replace(/(\w+)\s*\/=\s*/g, '$1 = $1 / ');
    
    return robloxFunctions + converted;
}

async function obfuscateLua(code, preset = 'Medium') {
    const startTime = Date.now();
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputFile = path.join(TEMP_DIR, `${tempId}_input.lua`);
    const outputFile = path.join(TEMP_DIR, `${tempId}_output.lua`);
    
    try {
        // Converter código
        const convertedCode = convertLuauToLua51(code);
        await fs.writeFile(inputFile, convertedCode, 'utf8');
        
        const prometheusDir = path.join(__dirname, 'prometheus');
        const cliPath = path.join(prometheusDir, 'cli.lua');
        
        console.log(`🔥 Starting obfuscation with ${preset} preset`);
        
        try {
            const { stdout, stderr } = await execFilePromise('lua5.1', [
                cliPath,
                '--preset', preset,
                '--nocolors',
                inputFile,
                '--out', outputFile
            ], {
                cwd: prometheusDir,
                timeout: 300000,
                maxBuffer: 50 * 1024 * 1024
            });
            
            if (stdout) console.log('✅', stdout);
            if (stderr) console.log('⚠️', stderr);
            
        } catch (error) {
            console.error('❌ Obfuscation error:', error.message);
            throw new Error(`Obfuscation failed: ${error.message}`);
        }
        
        // Ler resultado
        let obfuscatedCode = await fs.readFile(outputFile, 'utf8');
        obfuscatedCode = `-- Mønlur Obfuscator v1.0\n\n` + obfuscatedCode;
        
        // Cleanup
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
        
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Done in ${processingTime}ms`);
        
        return {
            success: true,
            code: obfuscatedCode,
            processingTime,
            originalSize: code.length,
            obfuscatedSize: obfuscatedCode.length
        };
        
    } catch (error) {
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
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
        
        const validPresets = ['Weak', 'Medium', 'Strong', 'Minify'];
        const selectedPreset = validPresets.includes(preset) ? preset : 'Medium';
        
        console.log(`📥 Request: ${selectedPreset}, ${code.length} chars`);
        
        const result = await obfuscateLua(code, selectedPreset);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, async () => {
    console.log(`🔥 Mønlur API running on port ${PORT}`);
    await ensureTempDir();
    setInterval(cleanupTempFiles, 5 * 60 * 1000);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
