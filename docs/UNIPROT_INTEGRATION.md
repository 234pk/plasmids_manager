# UniProt Integration Design Document

## Overview
Enhance the Plasmid Management System by integrating direct UniProt data retrieval. Replace the existing external link behavior of the 'U' button with an in-app modal that fetches and displays protein information.

## Objectives
1.  **In-App Search**: Eliminate the need to open external browser tabs for basic protein info.
2.  **Data Enhancement**: Allow users to easily populate plasmid fields (Molecular Weight, Function, Sequence) from UniProt data.
3.  **User Experience**: Provide a seamless, non-intrusive modal interface.

## UI/UX Design

### Entry Point
- **Location**: Plasmid List View -> Target Gene Column.
- **Element**: The existing 'U' button (Blue).
- **Action**: Click triggers the `openUniProtModal` function.

### Modal Interface (`UniProtModal`)
- **Header**:
  - Title: "UniProt Search: [Target Gene Name]"
  - Close Button (X).
- **Body**:
  - **Loading State**: Spinner with "Searching UniProt database..." text.
  - **Result State**:
    - **Summary Card**:
      - Protein Name (e.g., "Green fluorescent protein").
      - UniProt ID (e.g., "P42212").
      - Organism (e.g., "Aequorea victoria").
    - **Details**:
      - Function: Brief description.
      - Mass: Molecular weight (Da).
      - Sequence: Preview of the sequence (first ~50 chars) with a "Copy" or "Use" button.
  - **Error/Empty State**:
    - Message: "No results found for [Gene Name]" or specific error message.
- **Footer**:
  - **"Fill Data" Button**: Updates the current plasmid's fields (Protein Name, Function, Mass, Sequence) with the fetched data.
  - **"Close" Button**.

## Technical Implementation

### Frontend (`app.js` & `index.html`)
- **State Management**:
  - `showUniProtModal` (Boolean): Controls modal visibility.
  - `uniProtModalData` (Object): Stores current search target, loading status, results, and errors.
- **Functions**:
  - `openUniProtModal(geneName)`: Resets state, opens modal, and triggers search.
  - `closeUniProtModal()`: Resets and closes modal.
  - `applyUniProtData()`: Maps result data to the currently edited plasmid (if applicable) or provides copy functionality.

### Data Service (`js/services/uniprotService.js`)
- **API Endpoint**: `https://rest.uniprot.org/uniprotkb/search`
- **Fields**:
  - `accession` (ID)
  - `protein_name` (Name)
  - `organism_name` (Organism)
  - `cc_function` (Function comments)
  - `gene_names` (Gene Name)
  - `mass` (Molecular Weight)
  - `sequence` (Sequence)
- **Transform Logic**:
  - Maps API response to internal format:
    ```javascript
    {
        uniprotId: entry.primaryAccession.value,
        name: entry.proteinDescription.recommendedName.fullName.value,
        function: entry.comments.find(c => c.commentType === 'FUNCTION').texts[0].value,
        mass: entry.sequence.mass,
        sequence: entry.sequence.value
    }
    ```

### Integration Logic
1.  User clicks 'U'.
2.  `openUniProtModal` is called.
3.  `UniProtService.search` is invoked with the gene name.
4.  Results are displayed in the modal.

## Future Enhancements
- Batch processing: Check multiple plasmids against UniProt.
- Advanced filtering: Allow selecting specific organisms if the gene name is ambiguous.
