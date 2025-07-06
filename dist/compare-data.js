"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareData = compareData;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
async function compareData() {
    console.log('🔍 Starting Pokemon data comparison...');
    try {
        // Load current data
        const currentDataPath = path_1.default.join(process.cwd(), 'data', 'game-master.json');
        const currentDataRaw = await promises_1.default.readFile(currentDataPath, 'utf-8');
        const currentData = JSON.parse(currentDataRaw);
        const currentPokemon = currentData.pokemon;
        // Load old data
        const oldDataPath = path_1.default.join(process.cwd(), 'src', 'temp', 'old_source.json');
        const oldDataRaw = await promises_1.default.readFile(oldDataPath, 'utf-8');
        const oldPokemon = JSON.parse(oldDataRaw);
        console.log(`📊 Old data: ${Object.keys(oldPokemon).length} Pokemon`);
        console.log(`📊 New data: ${Object.keys(currentPokemon).length} Pokemon`);
        const result = comparePokemonData(oldPokemon, currentPokemon);
        // Generate detailed report
        await generateReport(result);
        console.log('\n✅ Comparison completed!');
        console.log(`📄 Report saved to: comparison-report.txt`);
    }
    catch (error) {
        console.error('❌ Comparison failed:', error);
        process.exit(1);
    }
}
function comparePokemonData(oldData, newData) {
    const oldSpeciesIds = new Set(Object.keys(oldData));
    const newSpeciesIds = new Set(Object.keys(newData));
    const added = Array.from(newSpeciesIds).filter(id => !oldSpeciesIds.has(id));
    const removed = Array.from(oldSpeciesIds).filter(id => !newSpeciesIds.has(id));
    const common = Array.from(oldSpeciesIds).filter(id => newSpeciesIds.has(id));
    const modified = [];
    const unchanged = [];
    for (const speciesId of common) {
        const oldPokemon = oldData[speciesId];
        const newPokemon = newData[speciesId];
        const differences = comparePokemon(oldPokemon, newPokemon);
        if (differences.length > 0) {
            modified.push({
                speciesId,
                differences
            });
        }
        else {
            unchanged.push(speciesId);
        }
    }
    return {
        summary: {
            oldCount: oldSpeciesIds.size,
            newCount: newSpeciesIds.size,
            added: added.length,
            removed: removed.length,
            modified: modified.length,
            unchanged: unchanged.length
        },
        added,
        removed,
        modified,
        unchanged
    };
}
function comparePokemon(oldPokemon, newPokemon) {
    const differences = [];
    // Fields to compare
    const fields = [
        'dex', 'speciesName', 'imageUrl', 'goImageUrl', 'shinyGoImageUrl',
        'types', 'atk', 'def', 'hp', 'fastMoves', 'chargedMoves', 'eliteMoves',
        'legacyMoves', 'isShadow', 'isMega', 'familyId', 'parent', 'evolutions',
        'form', 'isLegendary', 'isMythical', 'isBeast', 'aliasId'
    ];
    for (const field of fields) {
        const oldValue = oldPokemon[field];
        const newValue = newPokemon[field];
        // Skip noise: undefined evolutions becoming empty arrays
        if (field === 'evolutions' && oldValue === undefined && Array.isArray(newValue) && newValue.length === 0) {
            continue;
        }
        // Skip noise: undefined boolean flags becoming false
        if ((field === 'isLegendary' || field === 'isMythical' || field === 'isBeast') &&
            oldValue === undefined && newValue === false) {
            continue;
        }
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            differences.push({
                field,
                oldValue,
                newValue
            });
        }
    }
    return differences;
}
async function generateReport(result) {
    const report = [
        'POKEMON DATA COMPARISON REPORT',
        '==============================',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        'SUMMARY',
        '-------',
        `Old Pokemon count: ${result.summary.oldCount}`,
        `New Pokemon count: ${result.summary.newCount}`,
        `Added: ${result.summary.added}`,
        `Removed: ${result.summary.removed}`,
        `Modified: ${result.summary.modified}`,
        `Unchanged: ${result.summary.unchanged}`,
        '',
        'DETAILED ANALYSIS',
        '=================',
        ''
    ];
    // Added Pokemon
    if (result.added.length > 0) {
        report.push('ADDED POKEMON:');
        report.push('---------------');
        result.added.forEach(speciesId => {
            report.push(`+ ${speciesId}`);
        });
        report.push('');
    }
    // Removed Pokemon
    if (result.removed.length > 0) {
        report.push('REMOVED POKEMON:');
        report.push('-----------------');
        result.removed.forEach(speciesId => {
            report.push(`- ${speciesId}`);
        });
        report.push('');
    }
    // Modified Pokemon
    if (result.modified.length > 0) {
        report.push('MODIFIED POKEMON:');
        report.push('------------------');
        result.modified.forEach(({ speciesId, differences }) => {
            report.push(`${speciesId}:`);
            differences.forEach(({ field, oldValue, newValue }) => {
                report.push(`  ${field}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`);
            });
            report.push('');
        });
    }
    // Sample of unchanged Pokemon
    if (result.unchanged.length > 0) {
        report.push('SAMPLE OF UNCHANGED POKEMON:');
        report.push('-------------------------------');
        const sample = result.unchanged.slice(0, 20);
        sample.forEach(speciesId => {
            report.push(`✓ ${speciesId}`);
        });
        if (result.unchanged.length > 20) {
            report.push(`... and ${result.unchanged.length - 20} more`);
        }
        report.push('');
    }
    // Write report to file
    const reportPath = path_1.default.join(process.cwd(), 'comparison-report.txt');
    await promises_1.default.writeFile(reportPath, report.join('\n'));
    // Also log summary to console
    console.log('\n📊 COMPARISON SUMMARY:');
    console.log(`   Old Pokemon: ${result.summary.oldCount}`);
    console.log(`   New Pokemon: ${result.summary.newCount}`);
    console.log(`   Added: ${result.summary.added}`);
    console.log(`   Removed: ${result.summary.removed}`);
    console.log(`   Modified: ${result.summary.modified}`);
    console.log(`   Unchanged: ${result.summary.unchanged}`);
    if (result.added.length > 0) {
        console.log('\n➕ ADDED POKEMON:');
        result.added.slice(0, 10).forEach(speciesId => {
            console.log(`   + ${speciesId}`);
        });
        if (result.added.length > 10) {
            console.log(`   ... and ${result.added.length - 10} more`);
        }
    }
    if (result.removed.length > 0) {
        console.log('\n➖ REMOVED POKEMON:');
        result.removed.slice(0, 10).forEach(speciesId => {
            console.log(`   - ${speciesId}`);
        });
        if (result.removed.length > 10) {
            console.log(`   ... and ${result.removed.length - 10} more`);
        }
    }
    if (result.modified.length > 0) {
        console.log('\n🔄 MODIFIED POKEMON:');
        result.modified.slice(0, 5).forEach(({ speciesId, differences }) => {
            console.log(`   ${speciesId}: ${differences.length} changes`);
        });
        if (result.modified.length > 5) {
            console.log(`   ... and ${result.modified.length - 5} more`);
        }
    }
}
// Run if called directly
if (require.main === module) {
    compareData();
}
