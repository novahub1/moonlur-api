const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const execFilePromise = util.promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth middleware
app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

// CORS
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

async function obfuscateLua(code, preset = 'Medium') {
    const startTime = Date.now();
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputFile = path.join(TEMP_DIR, `${tempId}_input.lua`);
    const outputFile = path.join(TEMP_DIR, `${tempId}_output.lua`);
    
    try {
        await fs.writeFile(inputFile, code, 'utf8');
        
        const prometheusDir = path.join(__dirname, 'prometheus');
        const cliPath = path.join(prometheusDir, 'cli.lua');
        
        console.log(`🔥 Mønlur Obfuscator - Starting obfuscation`);
        console.log(`📊 Preset: ${preset}`);
        console.log(`📊 Code size: ${code.length} bytes`);
        
        try {
            // Tentar com Luau primeiro
            const { stdout, stderr } = await Promise.race([
                execFilePromise('luau', [
                    cliPath,
                    '--preset', preset,
                    '--nocolors',
                    inputFile,
                    '--out', outputFile
                ], {
                    cwd: prometheusDir,
                    timeout: 300000,
                    maxBuffer: 50 * 1024 * 1024
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Obfuscation timeout after 5 minutes')), 300000)
                )
            ]);
            
            if (stdout) console.log('✅ Prometheus output:', stdout);
            if (stderr) console.warn('⚠️ Prometheus warnings:', stderr);
            
        } catch (error) {
            console.error('❌ Obfuscation failed:', error.message);
            throw new Error(`Obfuscation failed: ${error.message}`);
        }
        
        // Verificar se o arquivo de saída foi criado
        try {
            await fs.access(outputFile);
        } catch {
            throw new Error('Output file was not created by Prometheus');
        }
        
        let obfuscatedCode = await fs.readFile(outputFile, 'utf8');
        
        // Header do Mønlur
        const header = `--[[\n` +
                      `    Mønlur Obfuscator v1.0\n` +
                      `    Powered by Prometheus\n` +
                      `    https://github.com/Levno7/prometheus\n` +
                      `]]\n\n`;
        
        obfuscatedCode = header + obfuscatedCode;
        
        // Cleanup
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
        
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Obfuscation completed successfully!`);
        console.log(`⏱️ Processing time: ${processingTime}ms`);
        console.log(`📊 Original size: ${code.length} bytes`);
        console.log(`📊 Obfuscated size: ${obfuscatedCode.length} bytes`);
        console.log(`📊 Size increase: ${((obfuscatedCode.length / code.length - 1) * 100).toFixed(2)}%`);
        
        return {
            success: true,
            code: obfuscatedCode,
            processingTime,
            originalSize: code.length,
            obfuscatedSize: obfuscatedCode.length
        };
        
    } catch (error) {
        // Cleanup em caso de erro
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
        throw error;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Mønlur Obfuscator API',
        version: '1.0.0',
        timestamp: Date.now() 
    });
});

// Obfuscation endpoint
app.post('/obfuscate', async (req, res) => {
    try {
        const { code, preset } = req.body;
        
        // Validações
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
        
        // Validar preset
        const validPresets = ['Weak', 'Medium', 'Strong', 'Minify'];
        const selectedPreset = validPresets.includes(preset) ? preset : 'Medium';
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📥 NEW OBFUSCATION REQUEST`);
        console.log(`📊 Preset: ${selectedPreset}`);
        console.log(`📊 Code length: ${code.length} characters`);
        console.log(`📊 IP: ${req.ip}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Executar obfuscação
        const result = await obfuscateLua(code, selectedPreset);
        
        res.json(result);
        
    } catch (error) {
        console.error('\n❌ OBFUSCATION ERROR:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🔥 MØNLUR OBFUSCATOR API');
    console.log('='.repeat(60));
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔧 Using Luau CLI for Roblox LuaU support`);
    console.log(`⚡ Powered by Prometheus Obfuscator`);
    console.log(`📝 Licensed under AGPL-3.0`);
    console.log('='.repeat(60) + '\n');
    
    await ensureTempDir();
    setInterval(cleanupTempFiles, 5 * 60 * 1000);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    process.exit(0);
});
