import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Executes the customer segmentation Python script.
 * 
 * This function spawns the python script from the mlModel directory
 * and logs its output. It's designed to be called by a scheduler.
 */
export const runCustomerSegmentation = () => {
    console.log('Starting customer segmentation script...');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const backendRoot = path.resolve(__dirname, '..', '..');

    // Path to the python executable within the virtual environment
    const pythonExecutable = path.resolve(backendRoot, 'python', 'venv', 'bin', 'python');
    
    // Path to the python script
    const pythonScript = path.resolve(backendRoot, 'mlModel', 'customer_segmentation.py');

    const pythonProcess = spawn(pythonExecutable, [pythonScript]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Python Script STDOUT]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Script STDERR]: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python script finished with code ${code}`);
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start Python script:', err);
    });
};

// If this script is run directly, execute the function.
// This allows for manual triggering, e.g., `ts-node src/scripts/run_ml_model.ts`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runCustomerSegmentation();
}
