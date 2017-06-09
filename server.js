const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const moment = require('moment');
const path = require('path');
const iotHubClient = require('./IoTHub/iot-hub.js');
const winston = require('winston');
var bodyParser = require('body-parser');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var helper = require('sendgrid').mail;
var sendgridAPIKey = process.env['Sendgrid.Api.Key'];
var sqlUserName = process.env['Sql.UserId'];
var sqlPassword = process.env['Sql.Password'];
var sqlServerName = process.env['Sql.Server.Name'];
var sqlDatabaseName = process.env['Sql.Database.Name'];
var sg = require('sendgrid')(sendgridAPIKey);

const app = express();

var emailId = '', emailTableRows=0, emailIdFromDatabase='', flag=1;

console.log('SendGrid API Key: ' + sendgridAPIKey);
console.log('Sql UserId: ' + sqlUserName);
console.log('Sql Password: ' + sqlPassword);
console.log('Sql Server Name: ' + sqlServerName);
console.log('Sql Database Name: ' + sqlDatabaseName);

// Create connection to database
var config = {
  userName: sqlUserName,
  password: sqlPassword,
  server: sqlServerName,
  options: {
      database: sqlDatabaseName,
	  encrypt: true
  }
}
var connection = new Connection(config);

// Attempt to connect and execute queries if connection goes through
connection.on('connect', function(err) {
    if (err) {
        console.log(err)
    }
    else{
		console.log('Connection to database established.');
        queryDatabase();
    }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//receive emailid entered by user
app.post("/", function (req, res, next) {
	emailId = req.body.emailId;
	updateInDatabase();
	res.end();
});

app.use(express.static(path.join(__dirname, '/public')));
app.use(function (req, res/*, next*/) {
  res.redirect('/');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function updateInDatabase(){
	if(emailTableRows != 0) {
		console.log("Updating emailid..");
		request = new Request(
			"UPDATE email SET EMAILID = '" + emailId + "' WHERE SNO = 1",
			function(err, rowCount, rows) {
				console.log(rowCount + ' row(s) updated');
				queryDatabase();
			}
		);
	}
	else {
		if(emailId!=''){
		console.log("Inserting emailid..");
		emailTableRows=1;
		request = new Request(
			"INSERT INTO email VALUES (1, '" + emailId + "')",
			function(err, rowCount, rows) {
				console.log(rowCount + ' row(s) inserted');
				emailTableRows=1;
				queryDatabase();
			}
		);
	}
	}
    connection.execSql(request);	
}

// Broadcast to all.
wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending data via websocket(Server): ' + data);
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

function queryDatabase(){
    console.log('Reading emailid from the table...');
    // Read all rows from table
    request = new Request(
        "SELECT emailid from email",
        function(err, rowCount, rows) {
			emailTableRows = rowCount;
            console.log(rowCount + ' row(s) returned from emailId table');
        }
    );

    request.on('row', function(columns) {
        columns.forEach(function(column) {
			emailIdFromDatabase = column.value;
			wss.broadcast(emailIdFromDatabase);
        });
    });

    connection.execSql(request);
}

//send mail if there is an alert
function sendEmail(obj) {
	console.log('Sending email to id : ' + emailIdFromDatabase);
	var data = JSON.parse(JSON.stringify(obj));
	if(parseInt(data.Alert) == 1) {		
		var fromEmail = new helper.Email('Jabil@email.com');
		var toEmail = new helper.Email(emailIdFromDatabase);
		var subject = 'Flash Test Alerts!';
		var content = new helper.Content('text/plain', 'Hi, \n Alert Message received at: ' + data.ReceiveTime + 
											'.\nFollowing are 5 temperature sensors value:\nSensor 1: ' + parseFloat(data.Parameters[0].Value).toFixed(2) +
											'\nSensor 2: ' + parseFloat(data.Parameters[1].Value).toFixed(2) + '\nSensor 3: ' + parseFloat(data.Parameters[2].Value).toFixed(2) +
											'\nSensor 4: ' + parseFloat(data.Parameters[3].Value).toFixed(2) + '\nSensor 5: ' +	parseFloat(data.Parameters[4].Value).toFixed(2) + '\n\n Thanks!');
		content = new helper.Content('text/html', '<html><body>Hi, <br><br> Alert Message received at time: ' + data.ReceiveTime + 
											'.<br>Following are 5 temperature sensors value:<br>Sensor 1: ' + parseFloat(data.Parameters[0].Value).toFixed(2) +
											'<br>Sensor 2: ' + parseFloat(data.Parameters[1].Value).toFixed(2) + '<br>Sensor 3: ' + parseFloat(data.Parameters[2].Value).toFixed(2) +
											'<br>Sensor 4: ' + parseFloat(data.Parameters[3].Value).toFixed(2) + '<br>Sensor 5: ' + parseFloat(data.Parameters[4].Value).toFixed(2) +
											'<br><br> Thanks!</body></html>');
		var mail = new helper.Mail(fromEmail, subject, toEmail, content);
		var request = sg.emptyRequest({
		  method: 'POST',
		  path: '/v3/mail/send',
		  body: mail.toJSON()
		});

		sg.API(request, function (error, response) {
		  if (error) {
			console.log('Error response received in sending email');
		  }
		});
	}
}
	

var iotHubReader = new iotHubClient(process.env['Azure.IoT.IoTHub.ConnectionString'], process.env['Azure.IoT.IoTHub.ConsumerGroup']);
iotHubReader.startReadMessage(function (obj, date) {
  try {
	//console.log('obj : ' + JSON.stringify(obj));
    date = date || Date.now()

	//to open popup on launch of webapp
	while(flag==1 && (emailTableRows==0 || emailTableRows==undefined))
	{
		flag = 0;
		wss.broadcast(0);
	}
	
	//send emailid to autopopulate in popup box
	if(emailIdFromDatabase!=''){
	wss.broadcast(emailIdFromDatabase);
	}
	
	//send json data to show in dashboard
    wss.broadcast(JSON.stringify(Object.assign(obj, { time: moment.utc(date).format('YYYY:MM:DD[T]hh:mm:ss') })));
	
	//calling sendEmail function
	sendEmail(obj);
  } catch (err) {
    console.error(err);
  }
});

var port = normalizePort(process.env.PORT || '3000');
server.listen(port, function listening() {
  console.log('Listening on %d', server.address().port);
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}
