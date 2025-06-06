export const getErrorMessages = (error: {
  [key: string]: string[] | undefined;
}) => {
  const errorMessages = Object.values(error).flat().join(", ");

  return "フォームの値が不正です。";
};
