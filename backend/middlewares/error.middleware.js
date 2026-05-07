export const errorHandler = (error, _req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Lỗi máy chủ nội bộ";

  // Mongoose validation error
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(error.errors)
      .map(val => val.message)
      .join(", ");
    // Optional: map common english strings to VN
    message = message.replace(/Path `(.+)` is required./g, "Trường '$1' là bắt buộc.");
    message = message.replace(/is required/g, "là bắt buộc");
  }

  // Mongoose bad objectId
  if (error.name === "CastError") {
    statusCode = 400;
    message = `Dữ liệu không hợp lệ ở trường: ${error.path}`;
  }

  // Mongoose duplicate key
  if (error.code === 11000) {
    statusCode = 400;
    const field = Object.keys(error.keyValue)[0];
    message = `Dữ liệu bị trùng lặp ở trường: ${field}`;
  }

  return res.status(statusCode).json({
    success: false,
    message: message
  });
};
