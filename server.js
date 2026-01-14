const express = require('express');
const { spawn } = require('child_process');
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

async function obfuscateLua(code, preset = 'Medium') {
    const startTime = Date.now();
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputFile = path.join(TEMP_DIR, `${tempId}_input.lua`);
    const outputFile = path.join(TEMP_DIR, `${tempId}_output.lua`);
    
    try {
        await fs.writeFile(inputFile, code, 'utf8');
        
        const wrapperScript = `
package.path = "./src/?.lua;./src/?/init.lua;" .. package.path

-- DISABLE LOGGER to avoid NameUpper error
package.loaded.logger = {
    info = function() end,
    warn = function() end,
    error = function() end,
    success = function() end,
    log = function() end
}

local args = {...}
local inputFile = args[1]
local outputFile = args[2]
local presetName = args[3]

-- Read input
local file = io.open(inputFile, "r")
if not file then
    error("Could not open input file")
end
local code = file:read("*all")
file:close()

-- Load presets
local presets = require("presets")
local preset = presets[presetName]
if not preset then
    error("Invalid preset")
end

-- Disable logging in preset
if preset.LuaVersion then
    preset.LuaVersion.Log = false
end

-- Load Pipeline
local Pipeline = require("prometheus.pipeline")

-- Create and run pipeline
local pipeline = Pipeline:new(preset)
local result = pipeline:apply(code)

-- Write output
local outFile = io.open(outputFile, "w")
if not outFile then
    error("Could not open output file")
end
outFile:write(result)
outFile:close()
`;
        
        const wrapperFile = path.join(TEMP_DIR, `${tempId}_wrapper.lua`);
        await fs.writeFile(wrapperFile, wrapperScript, 'utf8');
        
        const result = await new Promise((resolve, reject) => {
            const absInputFile = path.resolve(inputFile);
            const absOutputFile = path.resolve(outputFile);
            const absWrapperFile = path.resolve(wrapperFile);
            
            const luaProcess = spawn('lua', [absWrapperFile, absInputFile, absOutputFile, preset], {
                cwd: path.join(__dirname, 'prometheus')
            });
            
            let stdout = '';
            let stderr = '';
            
            luaProcess.stdout.on('data', (data) => stdout += data.toString());
            luaProcess.stderr.on('data', (data) => stderr += data.toString());
            
            luaProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Obfuscation failed: ${stderr || stdout}`));
                }
            });
            
            luaProcess.on('error', (error) => reject(error));
            
            setTimeout(() => {
                luaProcess.kill();
                reject(new Error('Obfuscation timeout'));
            }, 5 * 60 * 1000);
        });
        
        let obfuscatedCode = await fs.readFile(outputFile, 'utf8');
        const header = '-- This file was protected using Mønlur Obfuscator [v1.0]\n\n';
        obfuscatedCode = header + obfuscatedCode;
        
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
        await fs.unlink(wrapperFile).catch(() => {});
        
        const processingTime = Date.now() - startTime;
        
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

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
