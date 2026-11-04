export const variantGroups = rows => Object.keys(rows[0]?.options || {});

export const variantChoices = (rows, values, groupIndex) => {
    const groups = variantGroups(rows);
    const matches = rows.filter(row => groups.slice(0, groupIndex).every(group => row.options[group] === values[group]));
    return [...new Set(matches.map(row => row.options[groups[groupIndex]]).filter(Boolean))];
};

export const matchProductVariant = (rows, values) => {
    const groups = variantGroups(rows);
    return groups.length ? rows.find(row => groups.every(group => values[group] && row.options[group] === values[group])) : null;
};
