// Test script for the Obfuscation API
// Run: node test.js

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test_key_minimum_32_characters_long';

const testCode = `
print("Hello, World!")
local x = 5
local y = 10
local result = x + y
print("Result:", result)
`;

async function testAPI() {
    console.log('Testing Obfuscation API...\n');
    console.log(`API URL: ${API_URL}`);
    console.log(`API KEY: ${API_KEY.substring(0, 10)}...\n`);
    
    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${API_URL}/health`, {
            headers: {
                'x-api-key': API_KEY
            }
        });
        console.log('✅ Health check passed:', healthResponse.data);
        console.log('');
        
        // Test obfuscation
        console.log('2. Testing obfuscation endpoint...');
        console.log('Sending code to obfuscate...');
        
        const startTime = Date.now();
        const obfResponse = await axios.post(
            `${API_URL}/obfuscate`,
            {
                code: testCode,
                preset: 'Medium'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY
                }
            }
        );
        
        const endTime = Date.now();
        
        if (obfResponse.data.success) {
            console.log('✅ Obfuscation successful!');
            console.log('');
            console.log('Stats:');
            console.log(`- Processing time: ${obfResponse.data.processingTime}ms`);
            console.log(`- Total time: ${endTime - startTime}ms`);
            console.log(`- Original size: ${obfResponse.data.originalSize} bytes`);
            console.log(`- Obfuscated size: ${obfResponse.data.obfuscatedSize} bytes`);
            console.log('');
            console.log('Obfuscated code preview (first 200 chars):');
            console.log(obfResponse.data.code.substring(0, 200) + '...');
            console.log('');
            console.log('✅ All tests passed!');
        } else {
            console.log('❌ Obfuscation failed:', obfResponse.data.error);
        }
        
    } catch (error) {
        console.log('❌ Test failed!');
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', error.response.data);
        } else if (error.request) {
            console.log('No response from API. Is it running?');
        } else {
            console.log('Error:', error.message);
        }
        
        process.exit(1);
    }
}

testAPI();