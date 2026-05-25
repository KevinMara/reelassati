import React from "react";

export const SupportInApp = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Support</h1>
      <p className="text-muted-foreground mt-2">How can we help you today?</p>
    </div>
  );
};

const Placeholders = () => {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-xl font-semibold">Coming Soon</h2>
        <p className="text-muted-foreground">
          This section is currently under development. Relax, we're building something great.
        </p>
      </div>
    </div>
  );
};

export default Placeholders;
