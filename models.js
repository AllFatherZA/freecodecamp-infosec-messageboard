const mongoose = require("mongoose");
const { Schema } = mongoose;

const date = new Date();
const ReplySchema = new Schema({
    text: { type: String },
    delete_password: { type: String },
    created_on: { type: Date, default: date },
    bumped_on: { type: Date, default: date },
    reported: { type: Boolean, default: false },
  });

const ThreadSchema = new Schema({
    text: { type: String },
    delete_password: { type: String },
    reported: { type: Boolean, default: false },
    created_on: { type: Date, default: date },
    bumped_on: { type: Date, default: date },
    replies: { type: [ReplySchema] },
  });

  const Board_Schema = new Schema({
    name: {type: String},
    threads: { type: [ThreadSchema]},
  });

const Thread = mongoose.model("Thread", ThreadSchema);
const Reply = mongoose.model("Reply", ReplySchema);
const Board =mongoose.model("Board",Board_Schema);


const getThreadId = async (boardName = "test", text = "test", delete_password = "test") => {
  const board = await getBoard(boardName);
  let thread = await Thread.findOne({ text, delete_password });
  if (!thread) {
      thread = await Thread.create({
          text,
          delete_password,
          replies: [],
      });
      board.threads.push(thread._id);
      await board.save();
  }
  return thread;
};

const getReplyId = async (thread_id, text = "test", delete_password = "test") => {
  let thread = await Thread.findById(thread_id);
  if (!thread) return null;
  let reply = thread.replies.find(r => r.text === text);
  if (!reply) {
      reply = new Reply({
          text,
          created_on: new Date(),
          reported: false,
          delete_password,
      });
      thread.replies.push(reply);
      thread.bumped_on = new Date();
      await thread.save();
  }
  return reply;
};

const getBoard = async (name = "test") => {
  let board = await Board.findOne({ name });
  if (!board) {
      board = await Board.create({ name, threads: [] });
  }
  return board;
};





module.exports = { Thread, Reply,Board, getThreadId,getReplyId,getBoard };