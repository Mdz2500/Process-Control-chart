export const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };
  
  export const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals);
  };
  