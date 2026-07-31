import { useRef, useState, type DragEvent } from "react";

interface FileDropZoneOptions {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

export function useFileDropZone({
  disabled = false,
  onFiles,
}: FileDropZoneOptions) {
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const stopDrag = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    isDragging,
    dropZoneProps: {
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        stopDrag(event);
        if (disabled || !event.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setIsDragging(true);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        stopDrag(event);
        if (disabled) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        stopDrag(event);
        if (disabled) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        stopDrag(event);
        dragDepth.current = 0;
        setIsDragging(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      },
    },
  };
}
