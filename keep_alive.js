const http = require('http');

// Create a basic HTTP server
http.createServer(function (req, res) {
  res.write("I'm alive"); // Respond to incoming requests
  res.end();
}).listen(process.env.PORT || 8080, () => {
  console.log("Keep-alive server is running!");
});
