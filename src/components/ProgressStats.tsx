
interface ProgressStatsProps {
  modifiedCount: number;
  currentPosition: number;
  totalCells: number;
}

const ProgressStats = ({ modifiedCount, currentPosition, totalCells }: ProgressStatsProps) => {
  return (
    <div className="bg-blue-50 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-2">Progress Overview</h3>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{modifiedCount}</div>
          <div className="text-blue-700">Modified</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">{currentPosition}</div>
          <div className="text-gray-700">Current Position</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">{totalCells}</div>
          <div className="text-gray-700">Total Cells</div>
        </div>
      </div>
    </div>
  );
};

export default ProgressStats;
