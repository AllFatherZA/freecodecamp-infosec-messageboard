'use strict';
const { Thread, Reply, Board } = require("../models");

module.exports = function (app) {

app.route('/api/threads/:board')
  .post(async (req, res) => {
    const { board } = req.params;
    const { text, delete_password } = req.body;

    try {
      // Step 1: Create and save the thread
      const newThread = new Thread({
        text,
        delete_password,
        replies: [],
      });

      const savedThread = await newThread.save();

      // Step 2: Find or create the board
      let boardDoc = await Board.findOne({ name: board });

      if (!boardDoc) {
        // If the board doesn't exist, create it with the new thread's _id
        boardDoc = new Board({
          name: board,
          threads: [savedThread._id]  // <-- Initialize with array
        });
      } else {
        // If board exists but threads is missing (edge case), initialize it
        if (!Array.isArray(boardDoc.threads)) {
          boardDoc.threads = [];
        }

        // Add thread ID to board
        boardDoc.threads.push(savedThread._id);
      }

      await boardDoc.save();
      

      res.send(savedThread);
    } catch (error) {
      console.error("Error saving thread--", error);
      return res.status(500).send("Server error.");
    }
  })

  .get(async (req, res) => {
    const { board } = req.params;
  
    try {
      const boardDoc = await Board.findOne({ name: board }).populate({
        path: "threads",
        options: { sort: { bumped_on: -1 }, limit: 10 },
        populate: {
          path: "replies",
          options: { sort: { created_on: -1 } } // sort replies newest first
        }
      });
  
      if (!boardDoc) {
        return res.status(404).send("Board not found.");
      }
  
      const threadsToView = boardDoc.threads.map(thread => {
        const limitedReplies = thread.replies
          .slice(0, 3) // get 3 most recent replies (already sorted above)
          .map(reply => ({
            _id: reply._id,
            text: reply.text,
            created_on: reply.created_on,
          }));
  
        return {
          _id: thread._id,
          text: thread.text,
          created_on: thread.created_on,
          bumped_on: thread.bumped_on,
          replies: limitedReplies,
          replycount: thread.replies.length,
        };
      });
  
      res.json(threadsToView);
    } catch (err) {
      console.error("Error retrieving threads:", err);
      res.status(500).send("Server error");
    }
  })
  
    .delete(async (req, res) => {
            const { board, thread_id, delete_password } = req.body;
            const threadToDelete = await Thread.findById(thread_id);
            if (threadToDelete && threadToDelete.delete_password === delete_password) {
                await Thread.findByIdAndDelete(thread_id).exec();
                await Board.updateOne({ name: board }, { $pull: { threads: thread_id }});
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
      
        try {
          const threadToUpdate = await Thread.findById(thread_id);
          if (!threadToUpdate) {
            return res.status(404).send("Thread not found.");
          }
      
          // Save reply to database first
          const savedReply = await Reply.create({
            text,
            delete_password,
            created_on: replyCreationTime,
            bumped_on: replyCreationTime,
          });
      
          // Push only the saved reply's ID to the thread
          threadToUpdate.replies.push(savedReply._id);
          threadToUpdate.bumped_on = replyCreationTime;
          await threadToUpdate.save();
      
          

          try {
            const thread = await Thread.findById(thread_id).lean();
        
            if (!thread || !Array.isArray(thread.replies)) {
              throw new Error("Thread not found or invalid replies array");
            }
        
            // Fetch all replies using the stored ObjectIds
            const populatedReplies = await Reply.find({
              _id: { $in: thread.replies }
            }).lean();
        
            // Replace the `replies` array with full reply documents
            thread.replies = populatedReplies;
        
            return res.send(thread);
          } catch (err) {
            console.error("Error populating replies:", err);
            throw err;
          }
        } catch (err) {
          console.error("Error posting reply:", err);
          res.status(500).send("Server error.");
        }
      })
      
      
      .get(async (req, res) => {
        const { thread_id } = req.query;
      
        try {
          const thread = await Thread.findById(thread_id).populate({
            path: "replies",
            options: { sort: { created_on: -1 } } // Optional: show latest replies first
          });
      
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
      
          res.json(threadToView);
        } catch (err) {
          console.error("Error fetching thread:", err);
          res.status(500).send("Server error.");
        }
      })

       // Delete reply (mask text)
    .delete(async (req, res) => {
    const { thread_id, reply_id, delete_password } = req.body;

    try {
      const reply = await Reply.findById(reply_id);
      if (!reply || reply.delete_password !== delete_password) {
        return res.send("incorrect password");
      }

      reply.text = "[deleted]";
      await reply.save();
      await Thread.findByIdAndUpdate(thread_id, { bumped_on: new Date() });

      res.send("success");
    } catch (err) {
      console.error("Error deleting reply:", err);
      res.status(500).send("Server error.");
    }
  })

   // Report reply
   .put(async (req, res) => {
    const { reply_id } = req.body;

    try {
      const reply = await Reply.findById(reply_id);
      if (!reply) return res.send("incorrect");

      reply.reported = true;
      await reply.save();
      res.send("reported");
    } catch (err) {
      console.error("Error reporting reply:", err);
      res.status(500).send("Server error.");
    }
  })
      


    
};