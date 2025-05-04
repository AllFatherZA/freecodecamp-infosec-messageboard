const { Thread, Reply, Board } = require("./models"); // Adjust path
const mongoose = require('mongoose');
require("./DB-module");

async function generateTestData() {
    const testBoardName = "test";

    try {
        if (mongoose.connection.readyState !== 1) {
            console.log("Connecting to the database...");
            await mongoose.connect(process.env.DB);
        }

        // Clear existing test board and its threads
        await Board.deleteOne({ name: testBoardName });
        console.log(`Cleared existing board "${testBoardName}" and its threads.`);

        const testBoard = await Board.create({ name: testBoardName, threads: [] });

        for (let i = 1; i <= 10; i++) {
            const newThread = new Thread({
                text: `Test thread ${i} on board "${testBoardName}"`,
                delete_password: `password${i}`,
                replies: [],
            });

            for (let j = 1; j <= 3; j++) {
                const newReply = new Reply({
                    text: `Reply ${j} to thread ${i} on board "${testBoardName}"`,
                    delete_password: `replypass${i}-${j}`,
                });
                newThread.replies.push(newReply);

            }

            const savedThread = await newThread.save();
            testBoard.threads.push(savedThread);
            console.log(`Created thread ${i} with 3 replies on board "${testBoardName}".`);
        }

        await testBoard.save();
        console.log(`Successfully generated 10 test threads with 3 replies each on board "${testBoardName}".`);

    } catch (error) {
        console.error("Error generating test data:", error);
    } finally {
        // mongoose.connection.close(); // Adjust as needed
    }
}

module.exports = { generateTestData };