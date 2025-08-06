import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressStatsProps {
  modifiedCount: number;
  currentPosition: number;
  totalCells: number;
}

const ProgressStats = ({ modifiedCount, currentPosition, totalCells }: ProgressStatsProps) => {
  const percentage = totalCells > 0 ? Math.round((modifiedCount / totalCells) * 100) : 0;
  
  // Dynamic color based on percentage
  const getProgressColor = (percent: number) => {
    if (percent <= 33) return "bg-red-500";
    if (percent <= 66) return "bg-orange-500";
    return "bg-green-500";
  };

  return (
    <div className="bg-card rounded-lg p-4 border shadow-sm">
      <h3 className="font-semibold text-foreground mb-3">Progress Overview</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{modifiedCount} of {totalCells} cells completed</span>
          <span>{percentage}%</span>
        </div>
        <div className="relative">
          <Progress value={percentage} className="h-3" />
          <div 
            className={cn(
              "absolute top-0 left-0 h-full rounded-full transition-all duration-300",
              getProgressColor(percentage)
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProgressStats;