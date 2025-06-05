
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const InteractivePage = () => {
  const { pageName } = useParams();
  const navigate = useNavigate();
  
  // State for all text content
  const [centerText, setCenterText] = useState("Welcome to your interactive space");
  const [inputValue, setInputValue] = useState("");
  
  // State for the three right-side cells
  const [rightCells, setRightCells] = useState([
    { text1: "Status", text2: "Active" },
    { text1: "Mode", text2: "Dynamic" },
    { text1: "Level", text2: "Advanced" }
  ]);

  const handleChangeAll = () => {
    const randomTexts = [
      "Data synchronized successfully",
      "Neural network activated", 
      "Quantum state updated",
      "System optimization complete",
      "Digital transformation in progress"
    ];
    
    const randomStatuses = ["Online", "Processing", "Connected", "Synced", "Ready"];
    const randomModes = ["Auto", "Manual", "Smart", "Adaptive", "Responsive"];
    const randomLevels = ["Expert", "Pro", "Elite", "Master", "Supreme"];
    
    // Update center text
    setCenterText(randomTexts[Math.floor(Math.random() * randomTexts.length)]);
    
    // Update right cells
    setRightCells([
      { 
        text1: "Status", 
        text2: randomStatuses[Math.floor(Math.random() * randomStatuses.length)] 
      },
      { 
        text1: "Mode", 
        text2: randomModes[Math.floor(Math.random() * randomModes.length)] 
      },
      { 
        text1: "Level", 
        text2: randomLevels[Math.floor(Math.random() * randomLevels.length)] 
      }
    ]);
    
    // Clear input
    setInputValue("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="mb-4 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <h1 className="text-3xl font-bold text-slate-800">
          {decodeURIComponent(pageName || "Interactive Page")}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {/* Left Button */}
        <div className="lg:col-span-1">
          <Card className="h-full bg-gradient-to-br from-purple-500 to-blue-600 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-center h-full">
              <Button
                onClick={handleChangeAll}
                size="lg"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30 text-lg px-8 py-4 rounded-xl transition-all duration-300 hover:scale-105"
                variant="outline"
              >
                Transform All
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Middle Cell */}
        <div className="lg:col-span-2">
          <Card className="bg-white shadow-lg border-0 h-full">
            <CardContent className="p-8 flex flex-col justify-center h-full space-y-6">
              <div className="text-center">
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-6 border border-slate-200">
                  <p className="text-xl text-slate-700 font-medium leading-relaxed">
                    {centerText}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="textInput" className="text-sm font-medium text-slate-600">
                  Enter your message:
                </label>
                <Input
                  id="textInput"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type something here..."
                  className="text-lg p-4 border-slate-200 focus:border-blue-400 focus:ring-blue-400 rounded-lg"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Three Cells */}
        <div className="lg:col-span-1 space-y-4">
          {rightCells.map((cell, index) => (
            <Card key={index} className="bg-white shadow-md border-0 hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-600">
                    {cell.text1}
                  </span>
                  <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {cell.text2}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InteractivePage;
