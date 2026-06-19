import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 py-16 text-text-secondary">
      <div className="grid justify-items-center gap-3">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">加载中...</p>
      </div>
    </div>
  );
}
