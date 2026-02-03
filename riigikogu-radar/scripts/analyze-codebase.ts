#!/usr/bin/env npx tsx
/**
 * Codebase Analyzer - Self-Documentation System
 *
 * Automatically discovers and documents the project architecture.
 * Outputs machine-readable JSON and human-readable ASCII diagrams.
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

interface Feature {
  id: string;
  name: string;
  type: "api" | "page" | "lib" | "script" | "component";
  path: string;
  description?: string;
}

interface Layer {
  name: string;
  features: Feature[];
}

interface ArchitectureModel {
  version: string;
  generatedAt: string;
  stats: {
    totalFiles: number;
    apiRoutes: number;
    pages: number;
    components: number;
    scripts: number;
    libModules: number;
  };
  layers: {
    presentation: Layer;
    api: Layer;
    domain: Layer;
    infrastructure: Layer;
  };
}

// Discover API routes
function discoverApiRoutes(): Feature[] {
  const apiDir = path.join(PROJECT_ROOT, "src/app/api");
  const features: Feature[] = [];

  function walk(dir: string, prefix: string = "/api") {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, `${prefix}/${entry.name}`);
      } else if (entry.name === "route.ts") {
        const routePath = prefix.replace(/\/\[([^\]]+)\]/g, "/:$1");
        features.push({
          id: routePath.replace(/[/:]/g, "_"),
          name: routePath,
          type: "api",
          path: path.relative(PROJECT_ROOT, fullPath),
        });
      }
    }
  }

  walk(apiDir);
  return features;
}

// Discover pages
function discoverPages(): Feature[] {
  const pagesDir = path.join(PROJECT_ROOT, "src/app/[locale]");
  const features: Feature[] = [];

  function walk(dir: string, prefix: string = "") {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        walk(fullPath, `${prefix}/${entry.name}`);
      } else if (entry.name === "page.tsx") {
        const pagePath = prefix || "/";
        features.push({
          id: pagePath.replace(/[/:]/g, "_") || "home",
          name: pagePath || "/",
          type: "page",
          path: path.relative(PROJECT_ROOT, fullPath),
        });
      }
    }
  }

  walk(pagesDir);
  return features;
}

// Discover lib modules
function discoverLibModules(): Feature[] {
  const libDir = path.join(PROJECT_ROOT, "src/lib");
  const features: Feature[] = [];

  if (!fs.existsSync(libDir)) return features;

  const entries = fs.readdirSync(libDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      features.push({
        id: `lib_${entry.name}`,
        name: entry.name,
        type: "lib",
        path: `src/lib/${entry.name}`,
      });
    }
  }

  return features;
}

// Discover scripts
function discoverScripts(): Feature[] {
  const scriptsDir = path.join(PROJECT_ROOT, "scripts");
  const features: Feature[] = [];

  if (!fs.existsSync(scriptsDir)) return features;

  const entries = fs.readdirSync(scriptsDir);
  for (const entry of entries) {
    if (entry.endsWith(".ts")) {
      features.push({
        id: `script_${entry.replace(".ts", "")}`,
        name: entry.replace(".ts", ""),
        type: "script",
        path: `scripts/${entry}`,
      });
    }
  }

  return features;
}

// Discover components
function discoverComponents(): Feature[] {
  const componentsDir = path.join(PROJECT_ROOT, "src/components");
  const features: Feature[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
        features.push({
          id: `component_${entry.name.replace(".tsx", "")}`,
          name: entry.name.replace(".tsx", ""),
          type: "component",
          path: path.relative(PROJECT_ROOT, fullPath),
        });
      }
    }
  }

  walk(componentsDir);
  return features;
}

// Count files
function countFiles(): number {
  let count = 0;
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    if (dir.includes("node_modules") || dir.includes(".next") || dir.includes(".git")) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        count++;
      }
    }
  }
  walk(PROJECT_ROOT);
  return count;
}

// Generate ASCII diagram
function generateAsciiDiagram(model: ArchitectureModel): string {
  const lines: string[] = [];
  const width = 65;

  const box = (char: string) => char.repeat(width);
  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length - 2) / 2));
    return "│" + " ".repeat(pad) + text + " ".repeat(width - pad - text.length - 2) + "│";
  };
  const left = (text: string) => {
    const content = "│  " + text;
    return content + " ".repeat(Math.max(0, width - content.length - 1)) + "│";
  };

  lines.push("┌" + box("─") + "┐");
  lines.push(center("RIIGIKOGU RADAR - ARCHITECTURE"));
  lines.push(center(`Auto-generated ${model.generatedAt.split("T")[0]}`));
  lines.push("├" + box("─") + "┤");
  lines.push(left(""));

  // Presentation Layer
  lines.push(left(`PRESENTATION LAYER (${model.stats.pages} pages, ${model.stats.components} components)`));
  for (const feature of model.layers.presentation.features.slice(0, 6)) {
    lines.push(left(`├── ${feature.name.padEnd(14)} ${feature.type}`));
  }
  if (model.layers.presentation.features.length > 6) {
    lines.push(left(`└── ... and ${model.layers.presentation.features.length - 6} more`));
  }
  lines.push(left(""));

  // API Layer
  lines.push(left(`API LAYER (${model.stats.apiRoutes} routes)`));
  const apiGroups = new Map<string, number>();
  for (const feature of model.layers.api.features) {
    const group = feature.name.split("/").slice(0, 4).join("/");
    apiGroups.set(group, (apiGroups.get(group) || 0) + 1);
  }
  for (const [group, count] of Array.from(apiGroups.entries()).slice(0, 5)) {
    lines.push(left(`├── ${group}${count > 1 ? ` (${count} routes)` : ""}`));
  }
  lines.push(left(""));

  // Domain Layer
  lines.push(left(`DOMAIN LAYER (${model.stats.libModules} modules)`));
  for (const feature of model.layers.domain.features.slice(0, 6)) {
    lines.push(left(`├── ${feature.name}/`));
  }
  lines.push(left(""));

  // Infrastructure
  lines.push(left("INFRASTRUCTURE"));
  lines.push(left("├── MongoDB Atlas    Document storage"));
  lines.push(left("├── Voyage AI        Vector embeddings"));
  lines.push(left("├── Claude/OpenAI    AI predictions"));
  lines.push(left("└── Vercel           Hosting + Edge"));
  lines.push(left(""));

  // Stats
  lines.push(left(`STATS: ${model.stats.totalFiles} files | ${model.stats.apiRoutes} API routes | ${model.stats.pages} pages`));
  lines.push("└" + box("─") + "┘");

  return lines.join("\n");
}

// Main
async function main() {
  console.log("Analyzing codebase...\n");

  const apiRoutes = discoverApiRoutes();
  const pages = discoverPages();
  const libModules = discoverLibModules();
  const scripts = discoverScripts();
  const components = discoverComponents();

  const model: ArchitectureModel = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    stats: {
      totalFiles: countFiles(),
      apiRoutes: apiRoutes.length,
      pages: pages.length,
      components: components.length,
      scripts: scripts.length,
      libModules: libModules.length,
    },
    layers: {
      presentation: {
        name: "Presentation",
        features: [...pages, ...components],
      },
      api: {
        name: "API",
        features: apiRoutes,
      },
      domain: {
        name: "Domain",
        features: libModules,
      },
      infrastructure: {
        name: "Infrastructure",
        features: [],
      },
    },
  };

  // Output format based on args
  const args = process.argv.slice(2);
  const format = args.find((a) => a.startsWith("--format="))?.split("=")[1] || "both";
  const outputDir = path.join(PROJECT_ROOT, "docs/generated");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (format === "json" || format === "both") {
    const jsonPath = path.join(outputDir, "architecture.json");
    fs.writeFileSync(jsonPath, JSON.stringify(model, null, 2));
    console.log(`✓ Generated ${jsonPath}`);
  }

  if (format === "ascii" || format === "both") {
    const ascii = generateAsciiDiagram(model);
    console.log("\n" + ascii);

    const mdPath = path.join(outputDir, "architecture-ascii.md");
    fs.writeFileSync(mdPath, "```\n" + ascii + "\n```\n");
    console.log(`\n✓ Generated ${mdPath}`);
  }

  // Summary
  console.log("\n📊 Architecture Summary:");
  console.log(`   Files: ${model.stats.totalFiles}`);
  console.log(`   API Routes: ${model.stats.apiRoutes}`);
  console.log(`   Pages: ${model.stats.pages}`);
  console.log(`   Components: ${model.stats.components}`);
  console.log(`   Lib Modules: ${model.stats.libModules}`);
  console.log(`   Scripts: ${model.stats.scripts}`);
}

main().catch(console.error);
