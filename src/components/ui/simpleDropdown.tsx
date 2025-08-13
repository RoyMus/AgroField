import React from "react";

const SimpleDropdown = ({ options, onSelect }) => (
  <select onChange={(e) => onSelect(e.target.value)}>
    {options.map((opt, i) => (
      <option key={i}>{opt}</option>
    ))}
  </select>
);

export default SimpleDropdown;