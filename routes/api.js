'use strict';
const { Thread, Reply, Board } = require("../models");

module.exports = function (app) {

    app.route('/api/threads/:board')
        .post(async (req, res) => {
            const { board } = req.params;
            const { text, delete_password } = req.body;

            const boardDoc = await Board.findOne({ name: board });
            if (!boardDoc) {
                return res.status(404).send("Board not found.");
            }

            const newThread = new Thread({
                text,
                delete_password,
                replies: [],
            });

            const savedThread = await newThread.save();
            boardDoc.threads.push(savedThread._id);
            await boardDoc.save();
            res.send(savedThread);
        })
        .get(async (req, res) => {
            const { board } = req.params;
            const boardDoc = await Board.findOne({ name: board }).populate({
                path: 'threads',
                options: { sort: { bumped_on: 'desc' },},
                populate: {
                    path: 'replies',
                    options: { sort: { created_on: 'asc' }, limit: 3 },
                },
            });

            if (!boardDoc) {
                return res.status(404).send("Board not found.");
            }

            const threadsToView = boardDoc.threads.slice(0, 10).map(thread => ({
                _id: thread._id,
                text: thread.text,
                created_on: thread.created_on,
                bumped_on: thread.bumped_on,
                replies: thread.replies.map(reply => ({
                    _id: reply._id,
                    text: reply.text,
                    created_on: reply.created_on,
                })),
            }));

            res.send(threadsToView);
        })
        .delete(async (req, res) => {
            const { board, thread_id, delete_password } = req.body;

            const threadToDelete = await Thread.findById(thread_id);
            if (threadToDelete && threadToDelete.delete_password === delete_password) {
                await Thread.findByIdAndDelete(thread_id).exec();
                await Board.updateOne({ name: board }, { $pull: { threads: thread_id } });
                res.send("success");
            } else {
                res.send("incorrect password");
            }
        })
        .put(async (req, res) => {
            const { board, thread_id } = req.body;
            const threadToUpdate = await Thread.findById(thread_id);
            if (threadToUpdate) {
                threadToUpdate.reported = true;
                await threadToUpdate.save();
                res.send("reported");
            } else {
                res.send("incorrect thread id");
            }
        });

    app.route('/api/replies/:board')
        .post(async (req, res) => {
            const { board } = req.params;
            const { text, delete_password, thread_id } = req.body;
            const replyCreationTime = new Date();
            const reply = new Reply({
                text,
                delete_password,
                created_on: replyCreationTime,
            });

            const threadToUpdate = await Thread.findById(thread_id);
            if (!threadToUpdate) {
                return res.status(404).send("Thread not found.");
            }
            threadToUpdate.replies.push(reply);
            threadToUpdate.bumped_on = replyCreationTime;
            await threadToUpdate.save();
            res.send(threadToUpdate);
        })
        .get(async (req, res) => {
            const { thread_id } = req.query;
            const thread = await Thread.findById(thread_id).populate("replies");
            if (!thread) {
                return res.status(404).send("Thread not found.");
            }
            const threadToView = {
                _id: thread._id,
                text: thread.text,
                created_on: thread.created_on,
                bumped_on: thread.bumped_on,
                replies: thread.replies.map(reply => ({
                    _id: reply._id,
                    text: reply.text,
                    created_on: reply.created_on,
                })),
            };
            res.send(threadToView);
        })
        .delete(async (req, res) => {
            const { thread_id, reply_id, delete_password } = req.body;

            const threadTarget = await Thread.findById(thread_id);
            if (!threadTarget) {
                return res.status(404).send("Thread not found.");
            }
            const replyTarget = threadTarget.replies.find(reply => reply._id.toString() === reply_id && reply.delete_password === delete_password);

            if (replyTarget) {
                replyTarget.text = "[deleted]";
                threadTarget.bumped_on = new Date();
                await threadTarget.save();
                res.send("success");
            } else {
                res.send("incorrect password");
            }
        })
        .put(async (req, res) => {
            const { thread_id, reply_id, board } = req.body;
            const threadTarget = await Thread.findById(thread_id);
            if (!threadTarget) {
                return res.status(404).send("Thread not found.");
            }
            const replyTarget = threadTarget.replies.find(reply => reply._id.toString() === reply_id);

            if (replyTarget) {
                replyTarget.reported = true;
                threadTarget.bumped_on = new Date();
                await threadTarget.save();
                res.send("reported");
            } else {
                res.send("incorrect");
            }
        });
};