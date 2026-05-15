import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300">
      <div className="relative flex flex-col items-center gap-4">
        {/* Animated Gradient Ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl animate-pulse bg-primary/20" />
          <Loader2 className="h-12 w-12 animate-spin text-primary stroke-[1.5px]" />
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <h3 className="font-display text-lg font-bold tracking-tight">Loading</h3>
          <div className="flex gap-1">
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1 w-1 rounded-full bg-primary animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[101] h-1 overflow-hidden bg-muted">
      <div className="h-full bg-primary animate-progress origin-left" />
    </div>
  );
}
