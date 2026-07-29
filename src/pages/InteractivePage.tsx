import { observer } from 'mobx-react-lite';
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import SheetDataEditor from "@/components/SheetDataEditor";
import TopBar from "@/components/TopBarr";
import { drive } from "@/stores";

const InteractivePage = () => {
  const navigate = useNavigate();

  // Navigate home if no data after loading
  useEffect(() => {
    if (!drive.isLoading && !drive.isInitializing && !drive.sheet) {
      drive.clearSheet();
      navigate('/');
    }
  }, [drive.isLoading, drive.isInitializing, drive.sheet, navigate]);

  const handleBackToHome = () => {
    drive.clearSheet();
    navigate("/");
  };

  const handleEditSheet = () => {
    navigate("/edit-sheet");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-6 py-8">
          <div className="space-y-6">
            {drive.sheet && (
              <>
                <TopBar handleGoHome={handleBackToHome} onOpenEditor={handleEditSheet} />
                <SheetDataEditor />
              </>
            )}
          </div>
      </div>
    </div>
  );
};

export default observer(InteractivePage);
