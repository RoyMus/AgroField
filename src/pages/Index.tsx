
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  
  // Dynamic list of strings for the dropdown
  const pageOptions = [
    "Cosmic Dashboard",
    "Neural Network Hub", 
    "Quantum Workspace",
    "Digital Sanctuary",
    "Infinity Portal"
  ];

  const handlePageSelect = (option: string) => {
    navigate(`/page/${encodeURIComponent(option)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-8 px-6">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Welcome to the Future
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Discover innovative digital experiences crafted with precision and designed for tomorrow
          </p>
        </div>
        
        <div className="pt-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 transition-all duration-300 text-lg px-8 py-6 rounded-xl"
              >
                Choose Your Destination
                <ChevronDown className="ml-2 h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              className="w-64 bg-white/95 backdrop-blur-sm border-white/20 rounded-xl shadow-2xl"
              align="center"
            >
              {pageOptions.map((option, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handlePageSelect(option)}
                  className="text-slate-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer py-3 px-4 text-base rounded-lg mx-1 my-1 transition-all duration-200"
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="pt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Interactive</h3>
              <p className="text-slate-300 text-sm">Dynamic content that responds to your actions</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Modern</h3>
              <p className="text-slate-300 text-sm">Built with cutting-edge web technologies</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Responsive</h3>
              <p className="text-slate-300 text-sm">Perfect experience on any device</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
