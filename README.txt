Johnny Sylvain - 12/19/2025 Final Project: Wild West Forum

REPO: https://github.com/alegomonkey/WebserverFinal

HOSTED IP: 45.55.66.169
Internal PORT: 3010

DataBase name: alm.db

IN REPO IS VIDEO DEMOS: 
MIDTERM: Sylvain_Midterm_VDemo.mp4
FINAL: Sylvain_Final_VDemo.mp4

To run: clone repo: https://github.com/alegomonkey/WebserverFinal.git navigate into folder and execute:

docker-compose build docker-compose up

The server will be running on your IP!

PROXY SETUP: 
go to
http://[your domain]:5001/nginx/proxy
login and navigate to certificates
Encrypt via http, and enter your domain(s)
navigate to hosts->proxy hosts
add proxy host:
forward hostname: backend-nodejs 
port: 3010
Enable block common exploits and websocket support, SAVE
Edit proxy, and navigate to SSL
Select the SSL certificate you just made and enable force SSL.
DONE!


Security:
You must be logged in to access profiles, live chat and commenting.

Password must be at least 8 characters long.
Password must contain at least one uppercase letter.
Password must contain at least one lowercase letter.
Password must contain at least one number.
Password must contain at least one special character.

Passwords are hashed using argon2.
Passwords are only stored as hashes. 


CHAT API:
The live chat uses \chat route, through express: app.use('/chat', chatRoutes);
This API queries the Database for the 50 most recent chat messages and their timestamps and displays them on the board. Whenever a user submits a message this updates for all users. 

Database Schema:
TABLES: users, sessions, comments, comment_user_votes, chat_messages
users table stores: USER INFORMATION
- unique ID, username, email, display name, hashed password, name color (for live chat), bio (profile), if the account is locked, how many failed login attempts have been made, creation, update and last login dates.
session table stores: SESSION INFORMATION
- sid, sess, expire (all set with express sessions)
comments table stores: COMMENT DATA
- unique ID, associated user id, text, votes, created and updated timestamps
comment_user_votes table stores: USER VOTES ON COMMENTS (prevents multiple votes)
- unique ID, user ID, comment ID, vote
chat_messages table stores: All live chats
- unique ID, user ID, message, creation date

Known Limitations:
Nav partial requires session data that is not always parsed, so often the nav is incomplete even when logged in. 
The login success page does not have every available link.
Chat color for user name does not appear until reload
Votes on comments do not dynamically update, they need a page refresh


