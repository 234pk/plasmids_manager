# Plasmid Management System Development Log

## 2026-02-07 English Localization & UI Refinement
- **English Localization Optimization**:
  - **Guide Interface Localization**: Fully translated the user guide content (`gen_0665-gen_0687`) and navigation buttons ("Next Step", "Finish").
  - **UI Label Standardization**: Cleaned up `translations_data.js`, replacing Chinese terms and `[EN]` placeholders with proper English labels. Standardized "Holder" to "Owner" for clarity.
  - **Hardcoded String Removal**: Replaced all remaining hardcoded Chinese strings and `aria-label` attributes in `index.html` with dynamic translation calls.
  - **New Translation Entries**: Added keys `gen_1601-gen_1613` for tooltips, accessibility, and UI components.
- **Documentation & Engineering**:
  - Updated Chinese and English README files (`README.md`, `README.en.md`) with comprehensive feature descriptions, tech stack, and setup guides.
  - Established `.github/workflows/release.yml` for automated cross-platform (Windows, macOS) builds and releases via GitHub Actions.

## 2026-02-06 i18n & Recognition Optimization
- **i18n Localization Enhancement**:
  - **Comprehensive Translation**: Completed English translation for over 800 terms in `translations_data.js` using an automated script.
  - **Template Support**: Fixed issues with template string variables (e.g., `${count}`) being garbled or broken during translation.
  - **Dynamic Loading**: Optimized i18n script loading order in `index.html` to ensure translations are available before the main application starts.
  - **Language Persistence**: Verified language switching and state persistence across application reloads.
- **Recognition Algorithm Optimization (`recognition.js`)**:
  - **Accuracy Improvement**: Achieved significant accuracy gains (from ~59% to ~65% in random samples) through iterative testing and rule refinement.
  - **Target Gene Filtering**: Expanded `noiseWords` to exclude common plasmid components and resistance gene suffixes (e.g., KanR, AmpR) from being misidentified as target genes.
  - **Vector-Specific Inference**:
    - Added `VECTOR_PROMOTER_RULES` for automatic promoter inference (e.g., pLKO -> U6, pCDH -> CMV, Tet-On -> TRE).
    - Added `VECTOR_SPECIES_RULES` to infer host species (e.g., pUAST -> 果蝇, pLKO -> 哺乳动物).
    - Added `RESISTANCE_INFERENCE` for common carriers (e.g., pLKO -> Puro, pcDNA3 -> G418).
  - **Normalization Logic**:
    - Implemented vector type normalization (e.g., pLKO.1 -> pLKO, pcDNA3.1 -> pcDNA3) to match database standards.
    - Improved case-insensitive deduplication for target genes and other features.
  - **Heuristic Refinement**:
    - Increased minimum feature length to 3 characters for heuristic matching to reduce false positives (e.g., avoiding "pA" matching "pAc5").
    - Added filename-based promoter inference (e.g., detecting "Tet-On" or "TRE-" in filename).
- **Validation Framework**:
  - Created `optimize_recognition.js` as a regression test tool.
  - Implemented random sampling of 50 plasmids from the database for objective accuracy scoring and error reporting.
  - Added automated error analysis to identify common mismatch patterns.

## 2026-02-05 Verification & Stabilization
- **Feature Verification**:
  - **Smart Suggestions**: Verified `getSuggestions` logic in `app.js`. It correctly aggregates `PRESETS`, user `history` (localStorage), and existing database values (`dbValues`). The `suggestions` computed property is reactive and updates in real-time.
  - **Batch Import**: Verified `saveBatchImport` logic. It correctly deduplicates against existing names, handles file paths, saves sequences (Electron-only), and updates `plasmids.value` properly.
  - **Direct Add**: Verified `addNewItem` and `saveEdit`. The logic correctly handles new items (where `findIndex` returns -1) by pushing them to the array.
  - **UI Bindings**: Confirmed all 12 attribute fields in `index.html` (e.g., `list-突变`) are correctly bound to their respective datalists.
  - **Sequence View**: Verified `viewSequence` correctly loads sequences from memory, files, or extraction logic (Electron).

- **System Health**:
  - Validated that `Utils.ensureArray` and `Utils.ensureString` are used consistently to prevent data type errors.
  - Confirmed `isElectron` checks are in place for file system operations.

## 2026-02-05 New Features: Direct Add & Batch Paste
- **Direct Add**: Added "新建质粒" button to the header, allowing users to create a new plasmid entry without a file.
- **Batch Paste**: Added "批量粘贴" button and a dedicated modal to paste a list of plasmid names.
  - Implemented `handleBatchPaste` to parse pasted text (newlines/commas).
  - Integrated with the existing Batch Import workflow for recognition and deduplication.
  - Ensures seamless experience for users without physical files.

## 2026-02-05 Recognition Optimization & Smart Dropdowns
- **Recognition Logic Upgrade (`recognition.js`)**:
  - **Function Inference**: Added `FUNCTION_INFERENCE` rules to infer plasmid function (e.g., expression, viral packaging) from keywords.
  - **Resistance Inference**: Added `RESISTANCE_INFERENCE` to deduce antibiotic resistance (Amp, Kan, Puro, etc.) from gene names.
  - **Species Inference**: Added `GENE_SPECIES_RULES` to infer species (Mouse, Human, etc.) from gene prefixes/suffixes.
  - **Fuzzy Matching**: Implemented Levenshtein distance algorithm to handle minor spelling variations in recognition.
  - **Description Generation**: Added `generateDescription` to auto-generate a summary string from recognized attributes.
  - **Learning Function**: Implemented `learnFromUserCorrection` and `applyLearningRules` to remember user corrections and apply them in future recognitions (stored in localStorage).
  - **Target Gene Logic Improvement**: 
    - Fixed an issue where the entire plasmid name was recognized as a target gene by NLP.
    - Added length filtering (ignore if >= 80% of name length).
    - Improved exclusion logic: candidate target genes are now checked against ALL recognized features (Carrier, Tag, Promoter, etc.), not just Carriers.
- **Batch Import UI Enhancements**:
  - **Smart Dropdowns**: Added `list` attributes to input fields in the batch import table, binding them to the existing `suggestions` datalists.
  - **Learning Integration**: Updated `saveBatchImport` in `app.js` to detect user changes to recognized fields and invoke the learning function automatically.

## 2026-02-05 New Plasmid Auto-Recognition
- **Feature**: Added "智能解析" (Smart Parse) functionality to the "New Plasmid" / "Edit Plasmid" modal.
- **Implementation**:
  - **Mock File Object**: Created a mock file object `{ name: filename, path: '' }` to reuse the robust `Recognition.recognizePlasmid` engine.
  - **UI Integration**: Added a "智能解析" button next to the filename input field.
  - **Logic**: Users can enter a filename and click the button to auto-fill vector type, gene, species, resistance, etc., based on the name.
  - **Safety**: Verified that it works without requiring a physical file path (handles empty path gracefully).
- **Fix**: Corrected the function call in `autoRecognizeEdit` from `recognize` to `recognizePlasmid` and ensured correct arguments (`file`, `rules`, `existingPlasmids`) are passed.
