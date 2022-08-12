const SimpleBlockchainClient = require("./SimpleBlockchainClient");

describe("SimpleBlockchainClient", () => {
  it("can generate did", async () => {
    const newDID = await new SimpleBlockchainClient().createNewDID();
    console.log(newDID);
  });
});
