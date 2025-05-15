import { build, context as esbuildContext } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

const useWasmMinifier = process.env.FAST_BUILD !== 'true';
const isWatchMode = process.env.WATCH_MODE === 'true';

const glslPlugin = {
  name: 'glsl-conditional-minify',
  setup(buildProcess) {
    buildProcess.onLoad({ filter: /\.(vert|frag|glsl)$/ }, async (args) => {
      try {
        const shaderContent = await fs.readFile(args.path, 'utf8');
        let outputShader = shaderContent;

        if (useWasmMinifier) {
          console.log(`Minifying shader ${args.path} with shader-minifier-wasm...`);
          const { minify: minifyWasm } = await import('shader-minifier-wasm');
          outputShader = await minifyWasm(shaderContent, { preserveExternals: true, format: 'text' });
        } else {
          console.log(`Skipping WASM minification for shader ${args.path} (FAST_BUILD mode).`);
        }
        
        return {
          contents: `export default \`${outputShader}\`;`,
          loader: 'js',
        };
      } catch (error) {
        error.message = `Error processing shader ${args.path}: ${error.message}`;
        return {
          errors: [{ text: error.message, detail: error.stack }],
        };
      }
    });
  },
};

async function runBuild() {
  const buildOptions = {
    entryPoints: ['src/webgl-page-curl.js'],
    bundle: true,
    outfile: 'dist/webgl-page-curl.js',
    format: 'esm',
    minify: isWatchMode ? false : true,
    sourcemap: true,
    plugins: [glslPlugin],
  };

  try {
    if (isWatchMode) {
      console.log('Starting esbuild in watch mode...');
      const ctx = await esbuildContext(buildOptions);
      await ctx.watch();
      console.log('Watching for changes... (Press Ctrl+C to stop)');
      // Keep the process alive indefinitely for watch mode
      // This can be done by creating a promise that never resolves.
      await new Promise(() => {}); 
    } else {
      const result = await build(buildOptions);
      console.log(`Build successful! ${useWasmMinifier ? 'with shader-minifier-wasm' : '(FAST_BUILD mode, WASM minifier skipped)'}`);
      if (result.warnings.length > 0) {
        console.warn('Build warnings:', result.warnings);
      }
    }
  } catch (error) {
    // Handle errors from both build and context creation/watching
    const errorMessages = error.errors ? error.errors.map(e => e.text).join('\n') : error.message;
    console.error('Build process failed:', errorMessages);
    if (error.stack && !error.errors) console.error(error.stack); // Log stack if not already in error.errors
    if (!isWatchMode) {
      process.exit(1);
    }
  }
}

runBuild(); 