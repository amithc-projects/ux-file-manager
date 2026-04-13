import { useState, useCallback } from 'react';

export function useSelection<T>(items: T[], multiSelect = true) {
  // Array where order matters and null represents an intentional gap
  const [selectedIdsArray, setSelectedIdsArray] = useState<(string | null)[]>([]);

  const toggleSelection = useCallback(
    async (
      id: string,
      isShift: boolean,
      isMeta: boolean,
      isAlt: boolean,
      promptGap: () => Promise<boolean>
    ) => {
      setSelectedIdsArray((prev) => {
        let newSelection = [...prev];
        const existingIndex = newSelection.indexOf(id);

        if (existingIndex !== -1) {
          // Deselecting
          // If it is the last item in the sequence (even accounting for trailing nulls)
          const isHighestOrderedItem = !newSelection.slice(existingIndex + 1).some(Boolean);

          if (!multiSelect || (!isMeta && !isShift && !isAlt && newSelection.filter(Boolean).length === 1)) {
             newSelection[existingIndex] = null;
             while(newSelection.length > 0 && newSelection[newSelection.length - 1] === null) newSelection.pop();
             return newSelection;
          }

          // If no modifiers held and multiple selected, override entire selection to just this item
          if (!isMeta && !isShift && !isAlt && newSelection.filter(Boolean).length > 1) {
             return [id];
          }

          // If Alt+Click, OR it is the tail item, silently remove and close gap
          if (isAlt || isHighestOrderedItem) {
            newSelection[existingIndex] = null;
            while(newSelection.length > 0 && newSelection[newSelection.length - 1] === null) newSelection.pop();
            return newSelection;
          }

          // Otherwise trigger the external dialog promise without immediately returning modified state
          promptGap().then(leaveGap => {
             setSelectedIdsArray(curr => {
                const arr = [...curr];
                const idx = arr.indexOf(id);
                if (idx === -1) return arr;
                
                if (leaveGap) arr[idx] = null;
                else arr.splice(idx, 1);
                
                return arr;
             });
          });
          
          return newSelection; 
        }

        // Selecting new item -> Unmodified click wipes previous selection
        if (!multiSelect || (!isMeta && !isShift && !isAlt)) {
          return [id];
        }

        // Find first gap, else append
        const gapIndex = newSelection.indexOf(null);
        if (gapIndex !== -1) {
           newSelection[gapIndex] = id;
        } else {
           newSelection.push(id);
        }

        return newSelection;
      });
    },
    [multiSelect, items]
  );

  const clearSelection = useCallback(() => {
    setSelectedIdsArray([]);
  }, []);

  const fillGap = useCallback((index: number, id: string) => {
      setSelectedIdsArray(prev => {
          const arr = [...prev];
          arr[index] = id;
          return arr;
      });
  }, []);

  // Expose both the raw array and a derived Set for O(1) checks in render
  const selectedIds = new Set(selectedIdsArray.filter(Boolean) as string[]);

  return { selectedIdsArray, setSelectedIdsArray, selectedIds, toggleSelection, clearSelection };
}
