const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: false,
  },
  enterpriseName: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  rank: {
    type: String,
    enum: ["admin", "gerente", "colaborador"],
    default: "colaborador",
  },
  status: {
    type: String,
    default: "idle",
  },
  resetToken: {
    type: String,
  },
  expireToken: {
    type: Date,
  },
  email: {
    type: String,
    require: true,
    unique: true,
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.rank === "admin" ? false : true;
    },
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true,
  },
});

// userSchema.pre("save", function (next) {
//   const user = this;
//   if (!user.isModified("password")) {
//     return next();
//   }

//   bcrypt.genSalt(10, (err, salt) => {
//     if (err) {
//       return next(err);
//     }

//     bcrypt.hash(user.password, salt, (err, hash) => {
//       if (err) {
//         return next(err);
//       }
//       user.password = hash;
//       next();
//     });
//   });
// });

userSchema.methods.comparePassword = function (candidatePassword) {
  const user = this;

  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, user.password, (err, isMatch) => {
      if (err) {
        return reject(err);
      }

      if (!isMatch) {
        return reject(false);
      }

      resolve(true);
    });
  });
};

userSchema.plugin(mongoosePaginate);
mongoose.model("User", userSchema);
