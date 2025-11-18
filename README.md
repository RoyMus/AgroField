# AgroField

AgroField is a responsive web application designed to streamline data entry for field researchers. It integrates with Google Sheets and leverages OAuth for secure authentication, enabling users to interactively edit spreadsheet data while in the field.

## Features

- **Google Sheets Integration:** Connect your Google Drive account via OAuth and fetch all sheets available to you. Only sheets following the specified template can be used.  
- **Interactive Editing:**  
  - Edit individual cells directly in the UI.  
  - Skip quickly between cells for faster data entry.  
  - Use voice recognition to input data hands-free.  
- **Sheet Management:**  
  - Add new rows and columns to the sheet dynamically.  
  - Save your work into a new Google Sheets file in your Drive.  
- **Responsive Design:** Optimized for use on tablets and mobile devices in the field.

## Use Case

AgroField is specifically aimed at researcher operators working in agricultural or field studies. It simplifies the process of entering and managing data directly in Google Sheets, reducing errors and saving time.

## Technologies Used

- **Frontend:** Responsive web UI with interactive cell editing  
- **Backend:** OAuth authentication, Google Sheets API integration  
- **Voice Input:** Browser-based speech recognition  

## Getting Started

1. Clone the repository:  
   ```bash
   git clone <repository-url>
