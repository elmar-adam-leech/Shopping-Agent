import compression from "compression";

export const compress = compression({
  filter: (req, res) => {
    const contentType = res.getHeader("Content-Type");
    if (typeof contentType === "string" && contentType.includes("text/event-stream")) {
      return false;
    }
    return compression.filter(req, res);
  },
});
