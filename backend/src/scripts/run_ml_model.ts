import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Executes the customer segmentation Python script.
 * 
 * @param tenantId The unique ID of the tenant to process.
 * @returns A Promise that resolves when the script completes successfully, or rejects on error.
 */
export const runCustomerSegmentation = (tenantId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        console.log(`Starting customer segmentation script for tenant: ${tenantId}...`);

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const backendRoot = path.resolve(__dirname, '..', '..');

        // Path to the python executable within the virtual environment
        const pythonExecutable = path.resolve(backendRoot, 'python', 'venv', 'bin', 'python');

        // Path to the python script
        const pythonScript = path.resolve(backendRoot, 'mlModel', 'customer_segmentation.py');

        const pythonProcess = spawn(pythonExecutable, [pythonScript, tenantId]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[Python Script STDOUT - ${tenantId}]: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Python Script STDERR - ${tenantId}]: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python script for tenant ${tenantId} finished with code ${code}`);
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Python script exited with code ${code}`));
            }
        });

        pythonProcess.on('error', (err) => {
            console.error(`Failed to start Python script for tenant ${tenantId}:`, err);
            reject(err);
        });
    });
};

// If this script is run directly, execute the function with a default or command-line arg.
// This allows for manual triggering, e.g., `ts-node src/scripts/run_ml_model.ts <tenantId>`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const tenantId = process.argv[2] || "default_tenant";
    runCustomerSegmentation(tenantId);
}

