const crypto = require("crypto");
const Group = require("../models/Group");

exports.createGroup = async (req, res) => {
  try {
    const { name, creatorEmail } = req.body;

    const joinCode = crypto.randomBytes(6).toString("hex"); // UNIQUE LINK

    const group = new Group({
      name,
      members: [creatorEmail],
      joinCode
    });

    await group.save();

    res.json({
      message: "Group created successfully",
      groupId: group._id,
      joinLink: `https://yourdomain.com/join.html?code=${joinCode}`

    });

  } catch (err) {
    res.status(500).json({ message: "Error creating group" });
  }
};
const { sendEmailInvite } = require("../utils/email");
const crypto = require("crypto");

exports.createGroup = (req, res) => {
    const db = req.app.get("db");
    const { userId, groupName } = req.body;

    const groupId = crypto.randomBytes(8).toString("hex");

    db.run(
        "INSERT INTO groups (id, name, owner) VALUES (?,?,?)",
        [groupId, groupName, userId],
        function (err) {
            if (err) return res.json({ success: false });

            res.json({ success: true, groupId });
        }
    );
};

exports.sendInvite = async (req, res) => {
    const { email, groupId } = req.body;

    const joinLink = `http://localhost:5000/join.html?group=${groupId}`;

    const sent = await sendEmailInvite(email, joinLink);

    if (!sent) return res.json({ success: false });

    res.json({ success: true });
};

exports.joinGroup = (req, res) => {
    const groupId = req.params.groupId;
    res.send("You joined group: " + groupId);
};
