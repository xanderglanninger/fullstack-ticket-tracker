const express = require("express");
const fs = require("fs");
const path = require("path");
const { escape } = require("querystring");
const { CLIENT_RENEG_LIMIT } = require("tls");
const app = express();
const port = 3000;

const tempHome = fs.readFileSync(path.join(__dirname, "pages", "index.html"), "utf-8");
const tempTickets = fs.readFileSync(path.join(__dirname, "pages", "tickets.html"), "utf-8");
const tempPerson = fs.readFileSync(path.join(__dirname, "pages", "person.html"), "utf-8");
const tempAddPerson = fs.readFileSync(path.join(__dirname, "pages", "addperson.html"), "utf-8");
const ticketStructureNotInvoiced = fs.readFileSync(
  path.join(__dirname, "objects", "ticketstructurenotinvoiced.html"),
  "utf-8"
);

const ticketStructureInvoiced = fs.readFileSync(
  path.join(__dirname, "objects", "ticketstructureinvoiced.html"),
  "utf-8"
);

const ticketStructurePaid = fs.readFileSync(path.join(__dirname, "objects", "ticketstructurepaid.html"), "utf-8");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get(["/", "/index.html"], async (req, res) => {
  try {
    let output = tempHome;

    const notInvoicedCount = await GetCounter("countNotInvoice");
    const invoicedCount = await GetCounter("countInvoice");
    const paidCount = await GetCounter("countPaid");

    output = output.replace("{%NOTINVOICEDSTATS%}", notInvoicedCount);
    output = output.replace("{%INVOICEDSTATS%}", invoicedCount);
    output = output.replace("{%PAIDSTATS%}", paidCount);

    res.send(output);
  } catch (error) {
    res.status(500).send("Error retrieving counters.");
  }
});

app.get("/tickets.html", (req, res) => {
  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading data file.");
    }
    const dataObj = JSON.parse(data);

    const ticketsHtmlNotInvoiced = dataObj
      .map((el) => replaceTemplateNotInvoiced(ticketStructureNotInvoiced, el))
      .join("");
    let output = tempTickets.replace("{%TICKETBODYNOTINVOICED%}", ticketsHtmlNotInvoiced);

    const ticketsHtmlInvoiced = dataObj.map((el) => replaceTemplateInvoiced(ticketStructureInvoiced, el)).join("");
    output = output.replace("{%TICKETBODYINVOICED%}", ticketsHtmlInvoiced);

    const ticketsHtmlPaid = dataObj.map((el) => replaceTemplatePaid(ticketStructurePaid, el)).join("");
    output = output.replace("{%TICKETBODYPAID%}", ticketsHtmlPaid);

    res.send(output);
  });
});

app.get("/person.html", (req, res) => {
  res.send(tempPerson);
});

app.get("/addperson.html", (req, res) => {
  res.send(tempAddPerson);
});

app.post("/addPersonToFile", (req, res) => {
  console.log("Excecuted");
  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error reading data file." });
    }

    let personArray;
    try {
      personArray = JSON.parse(data);
    } catch (parseError) {
      return res.status(500).json({ success: false, message: "Error parsing data file." });
    }

    const count = personArray.length;

    const newPerson = {
      id: count + 1,
      name: req.body.name,
      surname: req.body.surname,
      dbalance: Number(req.body.dbalance),
      taxAccounting: req.body.taxOrAccounting,
      invoiced: JSON.parse(req.body.invoiced),
      invoiceAmount: Number(req.body.invoiceAmount),
      paid: false,
      description: req.body.paragraph_text,
    };

    personArray.push(newPerson);

    fs.writeFile(path.join(__dirname, "data", "personInfo.json"), JSON.stringify(personArray, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error writing data file." });
      }
    });

    const tempPerson = {
      id: newPerson.id,
    };
    //BUG
    if (!newPerson.invoiced) {
      fs.readFile(path.join(__dirname, "data", "countNotInvoice.json"), "utf-8", (err, data) => {
        let dataObj = JSON.parse(data);
        dataObj.push(tempPerson);
        fs.writeFile(path.join(__dirname, "data", "countNotInvoice.json"), JSON.stringify(dataObj, null, 2), (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: "Error writing data file." });
          }
        });
      });
    } else {
      fs.readFile(path.join(__dirname, "data", "countInvoice.json"), "utf-8", (err, data) => {
        let dataObj = JSON.parse(data);
        dataObj.push(tempPerson);
        fs.writeFile(path.join(__dirname, "data", "countInvoice.json"), JSON.stringify(dataObj, null, 2), (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: "Error writing data file." });
          }
        });
      });
    }
  });
  res.redirect("/tickets.html");
});

app.post("/displayPersonInfo", (req, res) => {
  const { id } = req.body;

  let output = tempPerson;
  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading data file.");
    }
    const dataObj = JSON.parse(data);
    dataObj.map((el) => {
      if (id == el.id) {
        output = output.replace(/{%PERSONNAME%}/g, el.name);
        //console.log(el.name);
        output = output.replace(/{%PERSONSURNAME%}/g, el.surname);
        //console.log(el.surname);
        output = output.replace("{%DELETEBALANCE%}", el.dbalance);
        //console.log(el.dbalance);
        output = output.replace("{%T/A%}", el.taxAccounting);
        //console.log(el.texAccounting);
        output = output.replace("{%INVOICED%}", el.invoiced);
        //console.log(el.invoiced);
        output = output.replace("{%BALANCE%}", el.invoiceAmount);
        //console.log(el.invoiceAmount);
        output = output.replace("{%DESCRIPTION%}", el.description);
        //console.log(el.description);
      }
    });
    res.send(output);
  });
});

app.post("/MoveFileToInvoice", (req, res) => {
  const { id } = req.body;

  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error reading data file." });
    }

    let dataObj = JSON.parse(data);
    dataObj = dataObj.map((el) => {
      if (el.id == id) {
        UpdateCounter(el.id, "countInvoice");
        el.invoiced = true;
        el.paid = false;
      }
      return el;
    });

    fs.writeFile(path.join(__dirname, "data", "personInfo.json"), JSON.stringify(dataObj, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error writing data file." });
      }
      res.json({ success: true });
    });
  });
});

app.post("/MoveFileToNotInvoice", (req, res) => {
  const { id } = req.body;

  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error reading data file." });
    }

    let dataObj = JSON.parse(data);
    dataObj = dataObj.map((el) => {
      if (el.id == id) {
        UpdateCounter(el.id, "countNotInvoice");
        el.invoiced = false;
        el.paid = false;
      }
      return el;
    });

    fs.writeFile(path.join(__dirname, "data", "personInfo.json"), JSON.stringify(dataObj, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error writing data file." });
      }
      res.json({ success: true });
    });
  });
});

app.post("/MoveFileToPaid", (req, res) => {
  const { id } = req.body;

  fs.readFile(path.join(__dirname, "data", "personInfo.json"), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error reading data file." });
    }

    let dataObj = JSON.parse(data);
    dataObj = dataObj.map((el) => {
      if (el.id == id) {
        UpdateCounter(el.id, "countPaid");
        el.invoiced = true;
        el.paid = true;
      }
      return el;
    });

    fs.writeFile(path.join(__dirname, "data", "personInfo.json"), JSON.stringify(dataObj, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error writing data file." });
      }
      res.json({ success: true });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const replaceTemplateNotInvoiced = (temp, product) => {
  let result = "";
  if (!product.invoiced) {
    result = temp.replace(/{%PERSONNAME%}/g, product.name + " " + product.surname);
    result = result.replace(/{%PERSONID%}/g, product.id);
  }
  return result;
};

const replaceTemplateInvoiced = (temp, product) => {
  let result = "";
  if (product.paid === false && product.invoiced === true) {
    result = temp.replace(/{%PERSONNAME%}/g, product.name + " " + product.surname);
    result = result.replace(/{%PERSONID%}/g, product.id);
  }
  return result;
};

const replaceTemplatePaid = (temp, product) => {
  let result = "";
  if (product.paid === true && product.invoiced === true) {
    result = temp.replace(/{%PERSONNAME%}/g, product.name + " " + product.surname);
    result = result.replace(/{%PERSONID%}/g, product.id);
  }
  return result;
};

//Called to increase and decrease the counters when one of the buttons are pressed
const GetCounter = (filename) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, "data", `${filename}.json`), "utf-8", (err, data) => {
      if (err) {
        return reject("Error reading data file.");
      }

      let dataObj;
      try {
        dataObj = JSON.parse(data);
      } catch (parseError) {
        return reject("Error parsing data file.");
      }

      resolve(dataObj.length);
    });
  });
};

const UpdateCounter = (personId, filename) => {
  fs.readFile(path.join(__dirname, "data", `${filename}.json`), "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error reading data file." });
    }

    let dataObj = [];

    if (data.length != 0) {
      try {
        dataObj = JSON.parse(data);
      } catch (parseError) {
        return res.status(500).json({ success: false, message: "Error parsing data file." });
      }
    }

    const newPerson = {
      id: personId,
    };

    dataObj.push(newPerson);
    removeCounter(personId, filename);

    fs.writeFile(path.join(__dirname, "data", `${filename}.json`), JSON.stringify(dataObj, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error writing data file." });
      }
    });
  });
};

const GetRemoveFile = (obj, personId) => {
  let found = false;
  obj.forEach((person) => {
    if (person.id == personId) {
      found = true;
    }
  });
  return found;
};

const removeCounter = (personId, filename) => {
  let removeFile = "";

  if (filename == "countInvoice") {
    fs.readFile(path.join(__dirname, "data", `countNotInvoice.json`), "utf-8", (err, data1) => {
      fs.readFile(path.join(__dirname, "data", `countPaid.json`), "utf-8", (err, data2) => {
        let objData1 = JSON.parse(data1);
        let objData2 = JSON.parse(data2);
        if (GetRemoveFile(objData1, personId) === true) {
          removeFile = "countNotInvoice";
        }

        if (GetRemoveFile(objData2, personId)) {
          removeFile = "countPaid";
        }
        executeRemove(removeFile, filename, personId);
      });
    });
  } else if (filename == "countNotInvoice") {
    console.log("countNotInvoice");
    fs.readFile(path.join(__dirname, "data", `countInvoice.json`), "utf-8", (err, data1) => {
      fs.readFile(path.join(__dirname, "data", `countPaid.json`), "utf-8", (err, data2) => {
        let objData1 = JSON.parse(data1);
        let objData2 = JSON.parse(data2);
        if (GetRemoveFile(objData1, personId)) {
          removeFile = "countInvoice";
        }
        if (GetRemoveFile(objData2, personId)) {
          removeFile = "countPaid";
        }
        executeRemove(removeFile, filename, personId);
      });
    });
  } else if (filename == "countPaid") {
    console.log("countPaid");
    fs.readFile(path.join(__dirname, "data", `countInvoice.json`), "utf-8", (err, data1) => {
      fs.readFile(path.join(__dirname, "data", `countNotInvoice.json`), "utf-8", (err, data2) => {
        let objData1 = JSON.parse(data1);
        let objData2 = JSON.parse(data2);
        if (GetRemoveFile(objData1, personId)) {
          removeFile = "countInvoice";
        }
        if (GetRemoveFile(objData2, personId)) {
          removeFile = "countNotInvoice";
        }
        executeRemove(removeFile, filename, personId);
      });
    });
  }
};

const executeRemove = (removeFile, filename, personId) => {
  console.log(removeFile + " " + filename + " " + personId);
  fs.readFile(path.join(__dirname, "data", `${removeFile}.json`), "utf-8", (err, data) => {
    if (err) {
      console.error("Error reading data file:", err.message);
      return;
    }

    let dataObj = [];

    if (data.length != 0) {
      try {
        dataObj = JSON.parse(data);
      } catch (parseError) {
        console.error("Error parsing data file:", parseError.message);
        return;
      }
    }

    dataObj = dataObj.filter((person) => person.id !== personId);

    fs.writeFile(path.join(__dirname, "data", `${removeFile}.json`), JSON.stringify(dataObj, null, 2), (err) => {
      if (err) {
        console.error("Error writing data file:", err.message);
      }
    });
  });
};
