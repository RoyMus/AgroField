
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoogleDriveFilePicker from "@/components/GoogleDriveFilePicker";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
      <div className="text-center space-y-8 px-6 max-w-4xl">
        <div className="space-y-6">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            </div>
            <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-sm"></div>
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-gray-800 mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-green-600 to-red-600 bg-clip-text text-transparent">
              Connect to Drive
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Access your Google Sheets directly from our platform. Select any spreadsheet from your Google Drive to get started.
          </p>
        </div>
        
        <div className="pt-8">
          <GoogleDriveFilePicker />
        </div>
        
        <div className="pt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <div className="w-6 h-6 bg-blue-500 rounded"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Secure Access</h3>
              <p className="text-gray-600 text-sm">Your data stays in Google Drive. We only access what you explicitly share.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <div className="w-6 h-6 bg-green-500 rounded"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Real-time Sync</h3>
              <p className="text-gray-600 text-sm">Changes in your Google Sheets are reflected immediately in our platform.</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-lg">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <div className="w-6 h-6 bg-red-500 rounded"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Easy Integration</h3>
              <p className="text-gray-600 text-sm">One-click connection to access all your spreadsheets and data.</p>
            </div>
          </div>
        </div>

        <div className="pt-8">
          <Button
            variant="outline"
            onClick={() => navigate("/page/workspace")}
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            Or explore our demo workspace
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
