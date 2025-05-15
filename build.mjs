import { build, context as esbuildContext } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

// Determine configuration from environment variables
const outputFile = process.env.OUTPUT_FILE || 'dist/webgl-page-curl.js';
const isWatchMode = process.env.WATCH_MODE === 'true';

// Determine minification levels
let minifyLevel = process.env.MINIFY_LEVEL || 'none'; // 'none', 'js_only', 'full'
if (isWatchMode) {
  minifyLevel = 'none'; // Override for watch mode for speed
}

const esbuildMinifyJS = minifyLevel === 'js_only' || minifyLevel === 'full';
const useWasmShaderMinifier = minifyLevel === 'full';

const glslPlugin = {
  name: 'glsl-conditional-minify',
  setup(buildProcess) {
    buildProcess.onLoad({ filter: /\.(vert|frag|glsl)$/ }, async (args) => {
      try {
        const shaderContent = await fs.readFile(args.path, 'utf8');
        let outputShader = shaderContent;

        if (useWasmShaderMinifier) {
          console.log(`Minifying shader ${args.path} with shader-minifier-wasm...`);
          const { minify: minifyWasm } = await import('shader-minifier-wasm');
          outputShader = await minifyWasm(shaderContent, { preserveExternals: true, format: 'text' });
        } else {
          console.log(`Skipping WASM shader minification for ${args.path} (minifyLevel: ${minifyLevel}).`);
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
    outfile: outputFile,
    format: 'esm',
    minify: esbuildMinifyJS,
    sourcemap: true, // Always generate sourcemaps, useful for both dev and prod (can be external for prod)
    plugins: [glslPlugin],
  };

  try {
    if (isWatchMode) {
      console.log(`Starting esbuild in watch mode for ${outputFile} (JS Minify: ${esbuildMinifyJS}, Shader Minify: ${useWasmShaderMinifier})...`);
      const ctx = await esbuildContext(buildOptions);
      await ctx.watch();
      console.log('Watching for changes... (Press Ctrl+C to stop)');
      await new Promise(() => {}); 
    } else {
      console.log(`Building ${outputFile} (JS Minify: ${esbuildMinifyJS}, Shader Minify: ${useWasmShaderMinifier})...`);
      const result = await build(buildOptions);
      console.log(`Successfully built ${outputFile}`);
      if (result.warnings.length > 0) {
        console.warn('Build warnings:', result.warnings);
      }
    }
  } catch (error) {
    const errorMessages = error.errors ? error.errors.map(e => e.text).join('\n') : error.message;
    console.error('Build process failed:', errorMessages);
    if (error.stack && !error.errors) console.error(error.stack);
    if (!isWatchMode) {
      process.exit(1);
    }
  }
}

runBuild(); 