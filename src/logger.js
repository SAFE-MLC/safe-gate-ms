export const log = (data) => {
  try {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: data.level || 'info',
      ...data,
    }));
  } catch {
    console.log(`[log-fallback] ${new Date().toISOString()} ${data?.event || 'event'}`);
  }
};
