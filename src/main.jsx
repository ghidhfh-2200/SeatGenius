import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewClassroom from "./pages/NewClassroom";
import UploadStudentName from "./pages/UploadStudentName";
import EditLabels from "./pages/EditLabelsClean";
import EvolutionStatus from "./pages/EvolutionStatus";
import EvolutionResult from "./pages/EvolutionResult";
import SeatPlanEditor from "./pages/SeatPlanEditor";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <HashRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/new-classroom" element={<NewClassroom />} />
                <Route path="/upload-students" element={<UploadStudentName />} />
                <Route path="/edit_labels" element={<EditLabels />} />
                <Route path="/evolution-status" element={<EvolutionStatus />} />
                <Route path="/evolution-result" element={<EvolutionResult />} />
                <Route path="/seat-plan-editor" element={<SeatPlanEditor />} />
            </Routes>
        </HashRouter>
    </React.StrictMode>,
);
