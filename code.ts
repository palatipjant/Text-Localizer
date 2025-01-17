interface TextLayer {
  name: string;
  content: string;
  id: string;
  selected?: boolean;
}

interface NotificationOptions {
  timeout?: number;
  error?: boolean;
  onDequeue?: (reason: NotifyDequeueReason) => void
  button?: {
    text: string
    action: () => boolean | void
  }
}

figma.showUI(__html__, { width: 800, height: 560 });

// Function to scan the selected frame
async function scanSelectedFrame() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return;
  }

  const frame = selection[0];
  if (frame.type !== 'FRAME') {
    return;
  }

  // Find all text layers in the frame
  const textLayers: TextLayer[] = [];
  function traverse(node: SceneNode): void {
    if (node.type === 'TEXT') {
      textLayers.push({
        name: node.name,
        content: node.characters,
        id: node.id,
        selected: true
      });
    }
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  traverse(frame);

  // Send the text layers to the UI
  figma.ui.postMessage({
    type: 'text-layers',
    layers: textLayers,
    frameName: frame.name
  });
}

// Run initial scan when plugin starts
scanSelectedFrame();

// Listen for messages from the UI
figma.ui.onmessage = async (msg: { type: string; layers?: TextLayer[] }) => {
  if (msg.type === 'scan-selection') {
    await scanSelectedFrame();
  }

  if (msg.type === 'export-csv-success') {
    figma.notify('🎉 File .csv export successfully', {
      timeout: 5000,
    });
  }

  if (msg.type === 'export-csv-error') {
    figma.notify('🔴 Failed to export .csv file', {
      timeout: 5000,
    });
  }

  if (msg.type === 'generate-variables' && msg.layers) {
    try {
      // Get current selection to identify the frame
      const selection = figma.currentPage.selection;
      if (selection.length === 0 || selection[0].type !== 'FRAME') {
        throw new Error('Please select a frame');
      }
      const frame = selection[0];
      const frameName = frame.name;

      // Filter only selected layers
      const selectedLayers = msg.layers.filter(layer => layer.selected);
      
      if (selectedLayers.length === 0) {
        return;
      }

      // Get or create the Localization collection
      const localVariableCollections = figma.variables.getLocalVariableCollections();
      let collection = localVariableCollections.find(c => c.name === "Localization");
      
      if (!collection) {
        collection = figma.variables.createVariableCollection("Localization");
      }
      
      // Get or create the default mode
      let defaultMode = collection.modes[0];
      if (!defaultMode) {
        const modeId = collection.addMode("Default");
        defaultMode = { modeId, name: "Default" };
      }

      // Create a map to track name occurrences
      const nameOccurrences = new Map<string, number>();

      // Create variables for selected layers
      let successCount = 0;
      let errorCount = 0;
      
      for (const layer of selectedLayers) {
        try {
          // Handle duplicate names
          const baseLayerName = layer.name;
          const count = nameOccurrences.get(baseLayerName) || 0;
          const layerName = count > 0 ? `${baseLayerName}_${count}` : baseLayerName;
          nameOccurrences.set(baseLayerName, count + 2);

          // Create variable name with frame prefix for grouping
          const variableName = `${frameName}/${layerName}`;
          
          // Create the variable
          const variable = figma.variables.createVariable(
            variableName,
            collection.id,
            "STRING"
          );
          
          // Set the value for the default mode
          await variable.setValueForMode(defaultMode.modeId, layer.content);
          
          // Find the original text layer and bind it to the variable
          const textNode = figma.getNodeById(layer.id);
          if (textNode && textNode.type === 'TEXT') {
            // Bind the variable to the text node
            await textNode.setBoundVariable('characters', variable);
            successCount++;
          }
        } catch (layerError) {
          console.error(`Error processing layer ${layer.name}:`, layerError);
          errorCount++;
        }
      }
      
      figma.notify(`🎉 Variables created successfully in "${frameName}" frame! (${successCount} succeeded, ${errorCount} failed)`, {
        timeout: 5000,
      });
    } catch (error) {
      figma.notify('🔴 Failed to created variables ' + (error as Error).message, {
        timeout: 5000,
      });
    }
  }
};