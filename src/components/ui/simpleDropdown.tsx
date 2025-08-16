const SimpleDropdown = ({ options, value, onSelect }) => {
  return (
    <select value={value} onChange={(e) => onSelect(e.target.value)}>
      {options.map((opt, i) => (
        <option key={i} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};

export default SimpleDropdown;