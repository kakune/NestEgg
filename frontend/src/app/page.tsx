export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Total Income</h2>
          <p className="text-2xl font-bold mt-2">¥0</p>
        </div>
        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Total Expenses</h2>
          <p className="text-2xl font-bold mt-2">¥0</p>
        </div>
        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Balance</h2>
          <p className="text-2xl font-bold mt-2">¥0</p>
        </div>
        <div className="bg-card text-card-foreground rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-muted-foreground">Pending Settlement</h2>
          <p className="text-2xl font-bold mt-2">¥0</p>
        </div>
      </div>
    </div>
  );
}