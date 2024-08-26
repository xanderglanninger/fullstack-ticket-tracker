const MoveFileToInvoice = (id,method) => {
  fetch(method, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Optionally reload the page or update the DOM
        window.location.reload();
      } else {
        console.error("Error updating the file");
      }
    })
    .catch((error) => console.error("Error:", error));
};

const displayPersonInfo = (id) => {
  fetch("/displayPersonInfo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  })
    .then((response) => response.text())
    .then((html) => {
      document.open();
      document.write(html);
      document.close();
      
    })
    .catch((error) => console.error("Error:", error));
    
};

