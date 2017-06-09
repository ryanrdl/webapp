$(document).ready(function () {
	
	//variables declaration
	var timeData = [], ambTemperatureData = [], avgTemperatureData = [];
	var tableData=[], tableDataReverse=[];
	var thresholdMsg = "Threshold Exceeded", msg = "Test Passed";
	var avgTemperature=0,sumTemp=0, ambTemperature=0; 
	var noOfTestPassed=0, noOfTestFailed=0;
	var maxAvgTemp=0, maxDiff=0;
	var emailId = '';

	document.getElementById('modalClose').style.visibility='hidden';
	
	//creating table
    $("#grid").shieldGrid({
        dataSource: {
            data: tableDataReverse
        },
		events: {
            dataBound: gridDataBound
        },
        rowHover: false,
        columns: [
            { field: "time", title: "Time", attributes: {style: "text-align: center; font-size: 14px"}, headerAttributes: { style: "text-align: center; font-size: 16px"}},
            { field: "ambTemp", title: "Ambient Temp", attributes: {style: "text-align: center; font-size: 14px"}, headerAttributes: { style: "text-align: center; font-size: 16px"}},
            { field: "avgTemp", title: "Average Temp", attributes: {style: "text-align: center; font-size: 14px"}, headerAttributes: { style: "text-align: center; font-size: 16px"}},
            { field: "message", title: "Message", attributes: {style: "text-align: center; font-size: 14px"}, headerAttributes: { style: "text-align: center; font-size: 16px"}}
        ]
    });

	//updating table (live)
    function refreshGird() {
        var grid = $("#grid").swidget(),
            initialOptions = grid.initialOptions;
        initialOptions.dataSource = {
            data: tableDataReverse
        };
        grid.refresh(initialOptions);
    }
	
	
	$.fn.openModal = function() {
        document.getElementById('emailId-modal').style.display='block';
		document.getElementById('emailId').value=emailId;
    };
	
	//styling table (assigning red/green colour)
	function gridDataBound(e) {
		var data = e.target.dataSource.view;
		var rows = e.target.contentTable.find(">tbody>tr");
		for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (item.message == thresholdMsg) {
                $(rows[i].cells[3]).addClass("red");
            }
            if (item.message == msg) {
                $(rows[i].cells[3]).addClass("green");
            }
        }
    }
	
	//data for line chart
	var data = {
		labels: timeData,
		datasets: [
		{
			fill: false,
			label: 'Ambient Temperature',
			yAxisID: 'AmbientTemperature',
			borderColor: "rgba(255, 204, 0, 1)",
			pointBoarderColor: "rgba(255, 204, 0, 1)",
			backgroundColor: "rgba(255, 204, 0, 0.4)",
			pointHoverBackgroundColor: "rgba(255, 204, 0, 1)",
			pointHoverBorderColor: "rgba(255, 204, 0, 1)",
			data: ambTemperatureData
		},
		{
			fill: false,
			label: 'Average Temperature',
			yAxisID: 'AverageTemperature',
			borderColor: "rgba(24, 120, 240, 1)",
			pointBoarderColor: "rgba(24, 120, 240, 1)",
			backgroundColor: "rgba(24, 120, 240, 0.4)",
			pointHoverBackgroundColor: "rgba(24, 120, 240, 1)",
			pointHoverBorderColor: "rgba(24, 120, 240, 1)",
			data: avgTemperatureData
		}
		]
	}

	//options for line chart
	var basicOption = {
		title: {
			display: true,
			text: 'Flash Test Live Data',
			fontSize: 36
		},
		scales: {
			yAxes: [{
				id: 'AmbientTemperature',
				type: 'linear',
				scaleLabel: {
					labelString: 'Ambient Temperature(C)',
					display: true
				},
				position: 'left',
			}, 
			{
				id: 'AverageTemperature',
				type: 'linear',
				scaleLabel: {
				labelString: 'Average Temperature(C)',
				display: true
				},
				position: 'right'
			}]
		}
	}

  	//data for pie chart
	var pieData = {
		labels: [
			"Test Failed",
			"Test Passed"
		],
		datasets: [
        {
            data: [noOfTestFailed, noOfTestPassed],
            backgroundColor: [
                "#FF6384",
                "#4BC0C0"
            ],
            hoverBackgroundColor: [
				"#FF6384",
				"#4BC0C0"
            ]
        }
		]
	};
	
	//options for pie chart
	var options = {
		cutoutPercentage : 0
	}
	
	//Get the context of the canvas element for line chart
	var ctx = document.getElementById("myChart").getContext("2d");
	var optionsNoAnimation = { animation: false }
	var myLineChart = new Chart(ctx, {
		type: 'line',
		data: data,
		options: basicOption
	});

	//Get the context of the canvas element for pie chart
	var pieContext = document.getElementById('pieChart').getContext('2d');
	var myPieChart = new Chart(pieContext,{
		type: 'pie',
		data: pieData,
		options: options
	});

	//websocket connection
	var ws = new WebSocket('wss://' + location.host);
	
	ws.onopen = function () {
		console.log('Successfully connect WebSocket');
	}
	
	//websocket receiving messages
	ws.onmessage = function (message) {
		console.log('Receive message via websocket in client side: ' + message.data);
		
		try {
			//if popup box has to open on launch of webapp
			if(message.data==0){
				//open popup box on launch
				$('#emailIdEllipsis').click();
			}
			else if((message.data).indexOf("@") >=0){
				if(emailId==''){
					document.getElementById('emailId').value=message.data;
				}
				emailId = message.data;
				document.getElementById('modalClose').style.visibility='visible';
			}
			else {
				var obj = JSON.parse(message.data);
				if(!obj.ReceiveTime || !obj.Parameters[0].Value || !obj.Parameters[1].Value || !obj.Parameters[2].Value || !obj.Parameters[3].Value || !obj.Parameters[4].Value) {
					return;
				}
				
				//time data to show in line chart
				timeData.push(obj.ReceiveTime);
				
				//calculating average temp
				sumTemp = parseFloat(obj.Parameters[0].Value) + parseFloat(obj.Parameters[1].Value) + parseFloat(obj.Parameters[2].Value) + parseFloat(obj.Parameters[3].Value);
				avgTemperature = (sumTemp)/4.0;
				
				avgTemperature = avgTemperature.toFixed(2);
				ambTemperature = parseFloat(obj.Parameters[4].Value);
				ambTemperature = ambTemperature.toFixed(2);
				
				//Ambient temp & Average temp to show in line chart
				ambTemperatureData.push(ambTemperature);
				avgTemperatureData.push(avgTemperature);
			  
				//Setting maximum value of average temp
				if(avgTemperature > maxAvgTemp){
					maxAvgTemp = avgTemperature;
				}
				
				//Setting maximum difference of average temp & ambient temp
				if(Math.abs(avgTemperature - ambTemperature) > maxDiff){
					maxDiff = (Math.abs(avgTemperature - ambTemperature)).toFixed(2);
				}
				
				//if alert, show in line chart
				if(parseInt(obj.Alert)==1){
								
					$("#label3").html(obj.ReceiveTime);
					
					if(tableData.length == 5){
						for(var i=0; i<(tableData.length)-1; i++){
							tableData[i]= tableData[i+1];
						}
						tableData[4]={
							time: obj.ReceiveTime,
							ambTemp: ambTemperature,
							avgTemp: avgTemperature,
							message: thresholdMsg
						};
					}
					else{
						tableData.push({
							time: obj.ReceiveTime,
							ambTemp: ambTemperature,
							avgTemp: avgTemperature,
							message: thresholdMsg
						});
					}
					noOfTestFailed++;
				}
				else {
					noOfTestPassed++;
				}
			  
				tableDataReverse = tableData.slice(0);
				tableDataReverse.reverse();
				
				// only keep no more than 50 points in the line chart
				var len = timeData.length;
				if (len > 50) {
					timeData.shift();
					ambTemperatureData.shift();
					avgTemperatureData.shift();
				}
				
				//Setting label values
				$("#label1").html(maxAvgTemp);
				$("#label2").html(maxDiff);
				$("#label4").html(noOfTestFailed);
				
				//Setting pie chart data
				pieData.datasets[0].data[0]=noOfTestFailed;
				pieData.datasets[0].data[1]=noOfTestPassed;
				
				//Update line & pie chart with new received values
				myLineChart.update();
				myPieChart.update();
				refreshGird();	
			}			
		}
		catch (err) {
		  console.error(err);
		}
	}
});