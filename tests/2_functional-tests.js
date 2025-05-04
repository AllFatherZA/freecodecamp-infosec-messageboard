const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');
const { Board, Thread } = require("../models"); // Import Board model

chai.use(chaiHttp);

const testBoardName = "test";
const threadPostData = { text: "test", delete_password: "test" };
const replyData = { text: "test", delete_password: "test" };
let testThreadId; // Variable to store a created thread ID for later tests

suite('Functional Tests', function () {
      before(async function () {
        try {
            const generateTestDataModule = require('../generate_test_data');
            if (typeof generateTestDataModule === 'function') {
                await generateTestDataModule();
            } else if (typeof generateTestDataModule.generateTestData === 'function') {
                await generateTestDataModule.generateTestData();
            } else {
                console.error("Error: generate_test_data.js did not export a function or an object with a generateTestData function.");
            }

            const testBoard = await Board.findOne({ name: testBoardName }).populate('threads');
            if (testBoard && testBoard.threads.length > 0) {
                testThreadId = testBoard.threads[0]._id.toString();
            } else {
                console.warn("Warning: No test threads found after data generation.");
            }
        } catch (error) {
            console.error("Error in before hook:", error);
            throw error; // Re-throw the error to fail the tests
        }
    });


    suite('API ROUTING FOR /api/threads/:board', function () {

        test("#1 POST: Creating a new thread", function (done) {
            chai.request(server)
                .post(`/api/threads/${testBoardName}`)
                .send(threadPostData)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.isDefined(res.body._id);
                    assert.isArray(res.body.replies);
                    testThreadId = res.body._id; // Store the created thread ID
                    done();
                });
        });

        test("#2 GET: Viewing the 10 most recent threads with 3 replies each", function (done) {
            chai.request(server)
                .get(`/api/threads/${testBoardName}`)
                .end(function (err, res) {
                    assert.equal(res.status, 200);
                    assert.isArray(res.body, "Response body should be an array");
                    assert.equal(res.body.length, 10, "Should return 10 threads");

                    res.body.forEach(function (thread) {
                        assert.exists(thread, "Each element in the array should be a thread");
                        assert.exists(thread._id, "Each thread should have an _id");
                        assert.exists(thread.text, "Each thread should have text");
                        assert.exists(thread.created_on, "Each thread should have created_on");
                        assert.exists(thread.bumped_on, "Each thread should have bumped_on");
                        assert.isArray(thread.replies, "Each thread should have a 'replies' property");
                        assert.isAtMost(thread.replies.length, 3, "Each thread should have at most 3 replies");
                        thread.replies.forEach(function (reply) {
                            assert.exists(reply, "Each element in the replies array should be a reply");
                            assert.exists(reply._id, "Each reply should have an _id");
                            assert.exists(reply.text, "Each reply should have text");
                            assert.exists(reply.created_on, "Each reply should have created_on");
                        });
                    });
                    done();
                });
        });

        test("#3 DELETE: Deleting a thread with the incorrect password", function (done) {
            chai.request(server)
                .delete(`/api/threads/${testBoardName}`)
                .send({
                    thread_id: testThreadId,
                    delete_password: "incorrect"
                })
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "incorrect password");
                    done();
                });
        });

        test("#4 DELETE: Deleting a thread with the correct password", async function () {
            // Re-create a thread to ensure it exists for deletion
            const newThread = await new Thread({ text: "delete me", delete_password: "deletepass", replies: [] }).save();
            const testBoard = await Board.findOne({ name: testBoardName });
            testBoard.threads.push(newThread._id);
            await testBoard.save();

            return new Promise((resolve, reject) => {
                chai.request(server)
                    .delete(`/api/threads/${testBoardName}`)
                    .send({
                        thread_id: newThread._id.toString(),
                        delete_password: "deletepass"
                    })
                    .end((err, res) => {
                        if (err) return reject(err);
                        assert.equal(res.status, 200);
                        assert.equal(res.text, "success");
                        resolve();
                    });
            });
        });

        test("#5 PUT: Reporting a thread", function (done) {
            chai.request(server)
                .put(`/api/threads/${testBoardName}`)
                .send({
                    thread_id: testThreadId,
                })
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "reported");
                    done();
                });
        });
    });

    suite('API ROUTING FOR /api/replies/:board', function () {
        let testReplyId;

        test("#6 POST: Creating a new reply", function (done) {
            chai.request(server)
                .post(`/api/replies/${testBoardName}`)
                .send({
                    text: replyData.text,
                    delete_password: replyData.delete_password,
                    thread_id: testThreadId,
                })
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.isDefined(res.body._id);
                    assert.isArray(res.body.replies);
                    assert.isObject(res.body.replies.find(reply => reply.text === replyData.text));
                    const newReply = res.body.replies.find(reply => reply.text === replyData.text);
                    assert.isDefined(newReply._id);
                    assert.isDefined(newReply.created_on);
                    testReplyId = newReply._id;
                    done();
                });
        });

        test("#7 GET: Viewing a single thread with all replies", function (done) {
            chai.request(server)
                .get(`/api/replies/${testBoardName}?thread_id=${testThreadId}`)
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.isObject(res.body);
                    assert.isDefined(res.body.text);
                    assert.isDefined(res.body.created_on);
                    assert.isDefined(res.body.bumped_on);
                    assert.isArray(res.body.replies);
                    assert.isObject(res.body.replies[0]);
                    assert.isDefined(res.body.replies[0].text);
                    assert.isDefined(res.body.replies[0].created_on);
                    done();
                });
        });

        test("#8 DELETE: Deleting a reply with the incorrect password", function (done) {
            chai.request(server)
                .delete(`/api/replies/${testBoardName}`)
                .send({
                    thread_id: testThreadId,
                    reply_id: testReplyId,
                    delete_password: "incorrect",
                })
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "incorrect password");
                    done();
                });
        });

        test("#9 DELETE: Deleting a reply with the correct password", async function () {
            // Re-fetch the thread to get the current replies
            const thread = await Thread.findById(testThreadId);
            const replyToDelete = thread.replies[0]; // Assuming there's at least one reply

            return new Promise((resolve, reject) => {
                chai.request(server)
                    .delete(`/api/replies/${testBoardName}`)
                    .send({
                        thread_id: testThreadId,
                        reply_id: replyToDelete._id.toString(),
                        delete_password: replyToDelete.delete_password || "test",
                    })
                    .end((err, res) => {
                        if (err) return reject(err);
                        assert.equal(res.status, 200);
                        assert.equal(res.text, "success");
                        resolve();
                    });
            });
        });

        test("#10 PUT: Reporting a reply", function (done) {
            chai.request(server)
                .put(`/api/replies/${testBoardName}`)
                .send({
                    thread_id: testThreadId,
                    reply_id: testReplyId,
                })
                .end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    assert.equal(res.text, "reported");
                    done();
                });
        });
    });
});