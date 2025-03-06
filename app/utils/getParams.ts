export const getParams = (urlString: string, name: string) => {
  const url = new URL(urlString);
  const searchParams = url.searchParams;
  return searchParams.get(name);
};
