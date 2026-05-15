#!/usr/bin/env node

/**
 * Bulk Timeline Restore Script
 * Restores all modified files to their May 14 07:47 AM timeline snapshots
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FILES_TO_RESTORE = [
  'generators/powerpoint.py',
  'outputs/GFCC26Apr2026_Eastertide.png',
  'outputs/GFCC26Apr2026_Eastertide.pptx',
  'outputs/GFCC26Apr2026_Eastertide_16x9.png',
  'outputs/GFCC26Apr2026_Eastertide_instagram_square.png',
  'outputs/GFCC26Apr2026_Eastertide_instagram_story.png',
  'outputs/GFCC26Apr2026_Eastertide_open_graph.png',
  'outputs/mass_bundle.zip',
  'outputs/posters/mass_poster_facebook.png',
  'outputs/posters/mass_poster_instagram.png',
  'outputs/posters/mass_poster_story.png',
  'pipeline.py',
  'server.py',
  'services/song_catalog.py',
  'templates/index.html',
];

const DELETED_FILES = [
  'services/mass_asset_utils.py',
  'services/pptx_template_analyzer.py',
  'services/saved_posters.py',
];

const UNTRACKED_FILES = [
  'services/mass_text_format.py',
  'services/ppt_template_analyze.py',
];

async function main() {
  console.log('🔄 Starting bulk Timeline restore for May 14 07:47 AM snapshot...\n');
  
  const workspaceRoot = process.cwd();
  console.log(`📁 Workspace: ${workspaceRoot}\n`);
  
  console.log('📋 Files that will be processed:');
  console.log(`   Modified: ${FILES_TO_RESTORE.length} files`);
  console.log(`   Deleted: ${DELETED_FILES.length} files`);
  console.log(`   Untracked (will be deleted): ${UNTRACKED_FILES.length} files\n`);
  
  console.log('⚠️  IMPORTANT INSTRUCTIONS:');
  console.log('   1. Open Cursor command palette (Cmd+Shift+P)');
  console.log('   2. For EACH file listed below, type "Timeline"');
  console.log('   3. Right-click on the May 14 07:47 AM entry');
  console.log('   4. Select "Restore" or similar option');
  console.log('   5. Confirm the restoration\n');
  
  console.log('📝 MODIFIED FILES (restore from Timeline):');
  FILES_TO_RESTORE.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  
  console.log('\n❌ DELETED FILES (restore these if needed):');
  DELETED_FILES.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  
  console.log('\n🗑️  UNTRACKED FILES (can be safely deleted):');
  UNTRACKED_FILES.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  
  console.log('\n---\n');
  console.log('🤖 Alternatively, would you like to use git to revert to the last commit?');
  console.log('   Command: git checkout .');
  console.log('   This will discard all uncommitted changes.\n');
}

main().catch(console.error);
