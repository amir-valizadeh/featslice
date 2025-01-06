export const capitalize = (str: string): string => {
    // Remove special characters like '(', ')', and '-'
    const cleanedStr = str.replace(/[()\-]/g, ' ');

    // Split into words, capitalize each word, and join them back
    return cleanedStr
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};